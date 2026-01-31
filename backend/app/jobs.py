"""Job management and background processing."""

from __future__ import annotations

import json
import os
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from app.config import AppConfig
from app.export.obsidian_md import build_markdown
from app.llm.summarize import (
    SummarizationConfig,
    summarize_transcript,
    OllamaUnavailableError,
)
from app.media.clip import create_clip_mp3
from app.pipeline.convert import convert_mp3_to_wav
from app.pipeline.vad import run_vad
from app.pipeline.transcribe import transcribe_chunks
from app.pipeline.merge import segments_to_text, segments_to_srt
from app.util.logger import log_line
from app.util.paths import ensure_app_dirs, ensure_job_dir, INBOX_DIR, OUT_DIR, TMP_DIR

# Avoid magic strings and keep consistent statuses.
STATUS_QUEUED = "queued"
STATUS_RUNNING = "running"
STATUS_DONE = "done"
STATUS_ERROR = "error"
STATUS_CANCELLED = "cancelled"

STAGE_CONVERT = "convert"
STAGE_VAD = "vad"
STAGE_TRANSCRIBE = "transcribe"
STAGE_MERGE = "merge"
STAGE_READY = "ready"
STAGE_EXPORT = "export"
STAGE_ERROR = "error"
STAGE_CANCELLED = "cancelled"

# Progress milestones (rough estimates).
PROGRESS_CONVERT = 10
PROGRESS_VAD = 25
PROGRESS_TRANSCRIBE = 80
PROGRESS_MERGE = 95
PROGRESS_DONE = 100


@dataclass
class Job:
    id: str
    filename: str
    status: str
    progress: int
    stage: str
    logs: List[str]
    created_at: str
    audio_path: str
    transcript_txt_path: str = ""
    transcript_json_path: str = ""
    transcript_srt_path: str = ""
    md_preview: str = ""
    # Summary fields are stored in memory for UI rendering and status reporting.
    # summary_md mirrors the saved summary.md file so the UI can display it quickly.
    summary_status: str = "not_started"
    summary_model: str = "none"
    summary_error: str = ""
    summary_md: str = ""
    exported_to_obsidian: bool = False
    cancel_requested: bool = False

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "filename": self.filename,
            "status": self.status,
            "progress": self.progress,
            "stage": self.stage,
            "logs": self.logs,
            "created_at": self.created_at,
            "audio_path": self.audio_path,
            "transcript_txt_path": self.transcript_txt_path,
            "transcript_json_path": self.transcript_json_path,
            "transcript_srt_path": self.transcript_srt_path,
            "md_preview": self.md_preview,
            # Summary metadata is returned so UI can show status and allow regeneration.
            "summary_status": self.summary_status,
            "summary_model": self.summary_model,
            "summary_error": self.summary_error,
            "summary_md": self.summary_md,
            "exported_to_obsidian": self.exported_to_obsidian,
        }


# In-memory store. This keeps MVP simple (no DB).
_JOBS: Dict[str, Job] = {}
_QUEUE: List[str] = []
_LOCK = threading.Lock()
_QUEUE_EVENT = threading.Event()

# Config shared between threads. It is updated when /config is saved.
_CONFIG: AppConfig = AppConfig()

# Background threads are created once.
_WORKER_STARTED = False
_INBOX_STARTED = False


def set_config(cfg: AppConfig) -> None:
    global _CONFIG
    _CONFIG = cfg


def _append_log(job: Job, message: str) -> None:
    job.logs.append(log_line(message))


def list_jobs() -> List[dict]:
    with _LOCK:
        return [job.to_dict() for job in _JOBS.values()]


def get_job(job_id: str) -> Optional[Job]:
    with _LOCK:
        return _JOBS.get(job_id)


def cancel_job(job_id: str) -> bool:
    with _LOCK:
        job = _JOBS.get(job_id)
        if not job:
            return False
        job.cancel_requested = True
        _append_log(job, "Cancellation requested")
        return True


def create_job_from_upload(filename: str, data: bytes) -> Job:
    """Create job and save uploaded MP3 bytes to disk."""

    ensure_app_dirs()
    job_id = uuid.uuid4().hex
    paths = ensure_job_dir(job_id)

    # Save original MP3 as required by spec.
    paths.original_mp3.write_bytes(data)

    job = Job(
        id=job_id,
        filename=filename,
        status=STATUS_QUEUED,
        progress=0,
        stage=STAGE_CONVERT,
        logs=[],
        created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        audio_path=str(paths.original_mp3),
    )

    _append_log(job, "Job created")

    with _LOCK:
        _JOBS[job_id] = job
        _QUEUE.append(job_id)
        _QUEUE_EVENT.set()

    return job


def create_job_from_inbox(mp3_path: Path) -> Job:
    """Create job by moving a file from inbox to out/<job_id>/original.mp3."""

    ensure_app_dirs()
    job_id = uuid.uuid4().hex
    paths = ensure_job_dir(job_id)

    # Move file into job folder. This also prevents re-processing.
    target = paths.original_mp3
    mp3_path.replace(target)

    job = Job(
        id=job_id,
        filename=mp3_path.name,
        status=STATUS_QUEUED,
        progress=0,
        stage=STAGE_CONVERT,
        logs=[],
        created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        audio_path=str(target),
    )

    _append_log(job, f"Job created from inbox file {mp3_path.name}")

    with _LOCK:
        _JOBS[job_id] = job
        _QUEUE.append(job_id)
        _QUEUE_EVENT.set()

    return job


def _pop_next_job() -> Optional[Job]:
    with _LOCK:
        if not _QUEUE:
            return None
        job_id = _QUEUE.pop(0)
        return _JOBS.get(job_id)


def _cancel_check(job: Job) -> bool:
    # We read a simple flag to avoid locking overhead in hot loops.
    return job.cancel_requested


def _process_job(job: Job) -> None:
    """Run the full pipeline for a job."""

    paths = ensure_job_dir(job.id)

    def log(msg: str) -> None:
        _append_log(job, msg)

    try:
        job.status = STATUS_RUNNING
        job.stage = STAGE_CONVERT
        job.progress = PROGRESS_CONVERT
        log("Starting convert step")
        convert_mp3_to_wav(paths.original_mp3, paths.audio_wav, log, lambda: _cancel_check(job))

        job.stage = STAGE_VAD
        job.progress = PROGRESS_VAD
        log("Starting VAD step")
        chunks = run_vad(paths.audio_wav, log, lambda: _cancel_check(job))
        log(f"VAD chunks: {chunks}")

        job.stage = STAGE_TRANSCRIBE
        job.progress = PROGRESS_TRANSCRIBE
        log("Starting transcribe step")
        last_logged = 0
        def update_transcribe_progress(done: int, total: int) -> None:
            nonlocal last_logged
            if total <= 0:
                return
            if done != last_logged:
                log(f"Transcribe progress: {done}/{total}")
                last_logged = done
            span = max(1, PROGRESS_MERGE - PROGRESS_TRANSCRIBE - 1)
            increment = int((done / total) * span)
            target = min(PROGRESS_MERGE - 1, PROGRESS_TRANSCRIBE + increment)
            if target > job.progress:
                job.progress = target

        segments = transcribe_chunks(
            paths.audio_wav,
            chunks,
            _CONFIG.model_size,
            _CONFIG.language,
            log,
            lambda: _cancel_check(job),
            TMP_DIR,
            update_transcribe_progress,
        )

        job.stage = STAGE_MERGE
        job.progress = PROGRESS_MERGE
        log("Starting merge step")

        # Persist segments and transcripts.
        transcript_text = segments_to_text(segments)
        paths.segments_json.write_text(
            json.dumps(segments, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        paths.transcript_txt.write_text(transcript_text, encoding="utf-8")
        paths.transcript_srt.write_text(segments_to_srt(segments), encoding="utf-8")

        # Summarization runs after merge and before Markdown export so that
        # the preview and Obsidian export include Summary. If Ollama is unavailable,
        # we skip without failing the job.
        summary_md = "## Summary\n— Не сгенерировано (Ollama недоступен или выключен)\n"
        summary_status = "not_started"
        summary_model = "none"
        summary_error = ""

        if _CONFIG.enable_summarization and _CONFIG.auto_summarize_after_transcription:
            summary_status = "running"
            summary_model = _CONFIG.ollama_model
            log("Starting summarization step")
            try:
                summary_cfg = SummarizationConfig(
                    base_url=_CONFIG.ollama_base_url,
                    model=_CONFIG.ollama_model,
                    enable=_CONFIG.enable_summarization,
                    auto=_CONFIG.auto_summarize_after_transcription,
                )
                summary_md = summarize_transcript(transcript_text, summary_cfg)
                summary_status = "done"
                log("Summarization completed")
            except OllamaUnavailableError:
                summary_status = "skipped"
                summary_md = "## Summary\n— Не сгенерировано (Ollama недоступен или выключен)\n"
                log("Ollama not available, skipping summarization")
            except Exception as exc:
                summary_status = "error"
                summary_error = str(exc)
                summary_md = "## Summary\n— Не сгенерировано (ошибка суммаризации)\n"
                log(f"Summarization failed: {exc}")
        else:
            # Summarization disabled in config; keep pipeline intact with a placeholder.
            summary_status = "skipped"

        # Persist summary artifacts for reuse/debugging. Summary is always saved,
        # even when skipped, so export can include a consistent Summary section.
        paths.summary_md.write_text(summary_md, encoding="utf-8")
        paths.summary_json.write_text(
            json.dumps(
                {
                    "status": summary_status,
                    "model": summary_model,
                    "error": summary_error,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        # Generate md preview (not exported automatically).
        md_preview = build_markdown(
            created_at=datetime.now(timezone.utc),
            model_size=_CONFIG.model_size,
            language=_CONFIG.language,
            summary_language="ru",
            summary_model=summary_model,
            summary_md=summary_md,
            audio_filename=job.filename,
            job_id=job.id,
            segments=segments,
        )
        paths.md_preview.write_text(md_preview, encoding="utf-8")
        job.md_preview = md_preview
        job.summary_status = summary_status
        job.summary_model = summary_model
        job.summary_error = summary_error
        job.summary_md = summary_md

        job.transcript_json_path = str(paths.segments_json)
        job.transcript_txt_path = str(paths.transcript_txt)
        job.transcript_srt_path = str(paths.transcript_srt)

        job.status = STATUS_DONE
        job.stage = STAGE_READY
        job.progress = PROGRESS_DONE
        log("Job completed")

    except Exception as exc:
        # If user requested cancellation, mark appropriately.
        if str(exc) == "cancelled" or job.cancel_requested:
            job.status = STATUS_CANCELLED
            job.stage = STAGE_CANCELLED
            job.progress = 0
            log("Job cancelled")
            return

        job.status = STATUS_ERROR
        job.stage = STAGE_ERROR
        job.progress = 0
        log(f"Job failed: {exc}")


def _worker_loop() -> None:
    """Background worker that processes queued jobs sequentially."""

    while True:
        job = _pop_next_job()
        if not job:
            # Wait for new jobs to arrive.
            _QUEUE_EVENT.clear()
            _QUEUE_EVENT.wait(timeout=1.0)
            continue

        _process_job(job)


def _inbox_loop() -> None:
    """Poll inbox directory and auto-create jobs if enabled."""

    while True:
        # Sleep first to avoid busy loop on startup.
        time.sleep(max(1, _CONFIG.inbox_poll_seconds))

        if not _CONFIG.watch_inbox_enabled:
            continue

        for mp3_path in INBOX_DIR.glob("*.mp3"):
            try:
                create_job_from_inbox(mp3_path)
            except Exception:
                # Avoid crashing watcher due to a single file.
                continue


def start_background_workers() -> None:
    """Start worker and inbox threads once."""

    global _WORKER_STARTED, _INBOX_STARTED
    if not _WORKER_STARTED:
        t = threading.Thread(target=_worker_loop, daemon=True)
        t.start()
        _WORKER_STARTED = True
    if not _INBOX_STARTED:
        t = threading.Thread(target=_inbox_loop, daemon=True)
        t.start()
        _INBOX_STARTED = True


def get_segments(job_id: str) -> List[dict]:
    job = get_job(job_id)
    if not job:
        raise FileNotFoundError("job not found")
    path = Path(job.transcript_json_path or (OUT_DIR / job_id / "segments.json"))
    if not path.exists():
        raise FileNotFoundError("segments not found")
    return json.loads(path.read_text(encoding="utf-8"))


def export_job_to_obsidian(job_id: str) -> Path:
    """Export a job to Obsidian vault based on current config."""

    job = get_job(job_id)
    if not job:
        raise FileNotFoundError("job not found")

    if not _CONFIG.vault_path:
        raise RuntimeError("vault_path is not set")

    # Load segments and summary for markdown generation. Summary is optional,
    # but export must include a Summary section in all cases.
    segments = get_segments(job_id)
    paths = ensure_job_dir(job_id)
    summary_md = ""
    if paths.summary_md.exists():
        summary_md = paths.summary_md.read_text(encoding="utf-8")
    if not summary_md.strip():
        summary_md = "## Summary\n— Не сгенерировано (Ollama недоступен или выключен)\n"

    md = build_markdown(
        created_at=datetime.now(timezone.utc),
        model_size=_CONFIG.model_size,
        language=_CONFIG.language,
        summary_language="ru",
        summary_model=job.summary_model or "none",
        summary_md=summary_md,
        audio_filename=job.filename,
        job_id=job.id,
        segments=segments,
    )

    # Build output filename format.
    ts = datetime.now().strftime("%Y-%m-%d %H%M")
    stem = Path(job.filename).stem
    filename = f"{ts} — {stem}.md"

    output_dir = Path(_CONFIG.vault_path) / _CONFIG.output_subfolder
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / filename
    output_path.write_text(md, encoding="utf-8")

    job.exported_to_obsidian = True
    job.md_preview = md
    job.stage = STAGE_EXPORT
    _append_log(job, f"Exported to Obsidian: {output_path}")

    return output_path


def create_clip(job_id: str, start: float, end: float) -> Path:
    job = get_job(job_id)
    if not job:
        raise FileNotFoundError("job not found")

    source = Path(job.audio_path)
    return create_clip_mp3(source, start, end, TMP_DIR)


def get_summary(job_id: str) -> dict:
    """Return summary data for a job.

    This is a lightweight accessor for the UI, which avoids sending
    the full job payload when only Summary is needed.
    """

    job = get_job(job_id)
    if not job:
        raise FileNotFoundError("job not found")
    paths = ensure_job_dir(job_id)
    summary_md = ""
    if paths.summary_md.exists():
        summary_md = paths.summary_md.read_text(encoding="utf-8")
    # Returning only summary fields keeps this endpoint light for UI polling.
    return {
        "summary_status": job.summary_status,
        "summary_model": job.summary_model,
        "summary_error": job.summary_error,
        "summary_md": summary_md or job.summary_md,
    }


def summarize_job(job_id: str) -> dict:
    """Manually (re)generate summary for an existing job.

    This reuses the same summarization logic as the pipeline but runs
    on-demand (UI button).
    """

    job = get_job(job_id)
    if not job:
        raise FileNotFoundError("job not found")

    paths = ensure_job_dir(job_id)
    if not paths.transcript_txt.exists():
        raise FileNotFoundError("transcript not found")

    transcript_text = paths.transcript_txt.read_text(encoding="utf-8")
    summary_md = "## Summary\n— Не сгенерировано (Ollama недоступен или выключен)\n"
    summary_status = "running"
    summary_model = _CONFIG.ollama_model
    summary_error = ""

    def log(msg: str) -> None:
        _append_log(job, msg)

    log("Manual summarization requested")

    if not _CONFIG.enable_summarization:
        # Honor config: if disabled, return a skipped status instead of trying Ollama.
        summary_status = "skipped"
        summary_md = "## Summary\n— Не сгенерировано (Ollama недоступен или выключен)\n"
        log("Summarization disabled in settings; skipping")
    else:
        try:
            summary_cfg = SummarizationConfig(
                base_url=_CONFIG.ollama_base_url,
                model=_CONFIG.ollama_model,
                enable=_CONFIG.enable_summarization,
                auto=_CONFIG.auto_summarize_after_transcription,
            )
            summary_md = summarize_transcript(transcript_text, summary_cfg)
            summary_status = "done"
            log("Manual summarization completed")
        except OllamaUnavailableError:
            summary_status = "skipped"
            summary_md = "## Summary\n— Не сгенерировано (Ollama недоступен или выключен)\n"
            log("Ollama not available, skipping summarization")
        except Exception as exc:
            summary_status = "error"
            summary_error = str(exc)
            summary_md = "## Summary\n— Не сгенерировано (ошибка суммаризации)\n"
            log(f"Manual summarization failed: {exc}")

    paths.summary_md.write_text(summary_md, encoding="utf-8")
    paths.summary_json.write_text(
        json.dumps(
            {
                "status": summary_status,
                "model": summary_model,
                "error": summary_error,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    # Refresh md_preview so UI reflects the regenerated Summary.
    try:
        segments = get_segments(job_id)
        md_preview = build_markdown(
            created_at=datetime.now(timezone.utc),
            model_size=_CONFIG.model_size,
            language=_CONFIG.language,
            summary_language="ru",
            summary_model=summary_model,
            summary_md=summary_md,
            audio_filename=job.filename,
            job_id=job.id,
            segments=segments,
        )
        paths.md_preview.write_text(md_preview, encoding="utf-8")
        job.md_preview = md_preview
    except Exception:
        # Preview refresh failure should not break summary regeneration.
        pass

    job.summary_status = summary_status
    job.summary_model = summary_model
    job.summary_error = summary_error
    job.summary_md = summary_md

    return {
        "summary_status": summary_status,
        "summary_model": summary_model,
        "summary_error": summary_error,
        "summary_md": summary_md,
    }
