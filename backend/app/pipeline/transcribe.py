"""Transcription using faster-whisper over VAD chunks."""

from __future__ import annotations

import os
import subprocess
import threading
import time
import sys
from pathlib import Path
from typing import List, Tuple, Dict, Callable, Optional

# Constants to avoid hidden magic numbers.
DEFAULT_LANGUAGE = "ru"
COMPUTE_TYPE = "int8"
DEVICE = "cpu"

_MODEL_CACHE: dict[str, object] = {}
_MODEL_LOCK = threading.Lock()


def _extract_chunk_to_wav(
    source_wav: Path,
    start: float,
    end: float,
    chunk_path: Path,
    log_fn,
) -> None:
    """Use ffmpeg to extract a chunk to a temporary wav file.

    We re-encode to keep consistent sample rate and mono audio.
    """

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(source_wav),
        "-ss",
        str(start),
        "-to",
        str(end),
        "-ac",
        "1",
        "-ar",
        "16000",
        str(chunk_path),
    ]
    log_fn(f"Extracting chunk: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        log_fn(f"ffmpeg chunk error: {result.stderr.strip()}")
        raise RuntimeError("ffmpeg chunk extract failed")


def _format_metrics(prev_cpu: float, prev_wall: float) -> tuple[str, float, float]:
    cpu_time = time.process_time()
    wall_time = time.time()
    cpu_percent = None
    delta_wall = wall_time - prev_wall
    if delta_wall > 0:
        cpu_percent = (cpu_time - prev_cpu) / delta_wall * 100.0

    rss_mb = None
    try:
        import resource

        rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        if sys.platform == "darwin":
            rss_mb = rss / (1024 * 1024)
        else:
            rss_mb = rss / 1024.0
    except Exception:
        pass

    load1 = None
    try:
        load1 = os.getloadavg()[0]
    except Exception:
        pass

    parts = []
    if cpu_percent is not None:
        parts.append(f"cpu={cpu_percent:.0f}%")
    if rss_mb is not None:
        parts.append(f"rss={rss_mb:.0f}MB")
    if load1 is not None:
        parts.append(f"load1={load1:.2f}")

    suffix = f" [{', '.join(parts)}]" if parts else ""
    return suffix, cpu_time, wall_time


def _load_whisper_model(model_size: str, log_fn):
    try:
        from faster_whisper import WhisperModel  # type: ignore
    except Exception as exc:
        log_fn(f"faster-whisper import failed: {exc}")
        return None

    with _MODEL_LOCK:
        cached = _MODEL_CACHE.get(model_size)
        if cached is not None:
            return cached

        # Load model once for all chunks.
        log_fn(
            "Loading WhisperModel size="
            f"{model_size} device={DEVICE} compute={COMPUTE_TYPE} "
            "(first run may download model files)"
        )
        load_stop = threading.Event()

        def _log_loading() -> None:
            prev_cpu = time.process_time()
            prev_wall = time.time()
            while not load_stop.wait(10):
                suffix, prev_cpu, prev_wall = _format_metrics(prev_cpu, prev_wall)
                log_fn(f"WhisperModel loading… still working{suffix}")

        load_thread = threading.Thread(target=_log_loading, daemon=True)
        load_thread.start()
        started_at = time.time()
        model = WhisperModel(model_size, device=DEVICE, compute_type=COMPUTE_TYPE)
        load_stop.set()
        load_thread.join(timeout=0.1)
        log_fn(f"WhisperModel loaded in {time.time() - started_at:.1f}s")

        _MODEL_CACHE[model_size] = model
        return model


def preload_whisper_model(model_size: str, log_fn) -> bool:
    return _load_whisper_model(model_size, log_fn) is not None


def transcribe_chunks(
    wav_path: Path,
    chunks: List[Tuple[float, float]],
    model_size: str,
    language: str,
    log_fn,
    cancel_check,
    tmp_dir: Path,
    progress_fn: Optional[Callable[[int, int], None]] = None,
) -> List[Dict[str, float | str]]:
    """Transcribe chunks and return absolute-time segments.

    Returns: list of {"start": float, "end": float, "text": str}
    """

    if os.getenv("PLAUD_TEST_MODE") == "1":
        log_fn("Transcribe skipped (test mode). Creating dummy segments.")
        segments = [
            {"start": float(start), "end": float(end), "text": "TEST SEGMENT"}
            for start, end in chunks
            if end > start
        ]
        if progress_fn is not None:
            progress_fn(len(chunks), len(chunks))
        return segments

    model = _load_whisper_model(model_size, log_fn)
    if model is None:
        # Fallback to dummy segments to avoid full crash.
        segments = [
            {"start": float(start), "end": float(end), "text": "(no model)"}
            for start, end in chunks
            if end > start
        ]
        if progress_fn is not None:
            progress_fn(len(chunks), len(chunks))
        return segments

    # Ensure temp directory exists for chunk files.
    tmp_dir.mkdir(parents=True, exist_ok=True)

    segments_out: List[Dict[str, float | str]] = []

    total_chunks = len(chunks)
    for idx, (start, end) in enumerate(chunks, start=1):
        if cancel_check():
            raise RuntimeError("cancelled")

        chunk_path = tmp_dir / f"chunk_{idx:03d}.wav"
        _extract_chunk_to_wav(wav_path, start, end, chunk_path, log_fn)

        # Use faster-whisper to transcribe the chunk.
        # We disable VAD because we already did chunking ourselves.
        log_fn(f"Transcribing chunk {idx}/{len(chunks)}")
        result_segments, _info = model.transcribe(
            str(chunk_path),
            language=language or DEFAULT_LANGUAGE,
            vad_filter=False,
        )

        for seg in result_segments:
            # Convert to absolute timeline by offsetting with chunk start.
            abs_start = float(start + seg.start)
            abs_end = float(start + seg.end)
            text = (seg.text or "").strip()
            if text:
                segments_out.append({"start": abs_start, "end": abs_end, "text": text})

        if progress_fn is not None:
            progress_fn(idx, total_chunks)

        # Clean up temp chunk to save disk space.
        try:
            chunk_path.unlink(missing_ok=True)
        except Exception:
            # If cleanup fails we can tolerate it; tmp dir is also cleaned by TTL.
            pass

    return segments_out
