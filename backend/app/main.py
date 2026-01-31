"""FastAPI entrypoint."""

from __future__ import annotations

from pathlib import Path
import os
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.config import AppConfig, load_config, save_config
from app.jobs import (
    list_jobs,
    get_job,
    cancel_job,
    create_job_from_upload,
    get_segments,
    export_job_to_obsidian,
    create_clip,
    get_summary,
    summarize_job,
    set_config,
    start_background_workers,
)
from app.pipeline.transcribe import preload_whisper_model
from app.model_download import (
    get_download_status,
    start_model_download,
    get_model_size_bytes,
)
from app.util.logger import log_line
from app.util.paths import ensure_app_dirs


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan handler to replace deprecated startup hooks.

    Keeping startup logic here avoids FastAPI on_event deprecation warnings.
    """

    ensure_app_dirs()
    cfg = load_config()
    set_config(cfg)
    start_background_workers()
    # Optional preloading keeps the first transcription responsive by downloading
    # Whisper weights at startup (if enabled).
    if cfg.preload_model or os.getenv("PLAUD_PRELOAD_MODEL") == "1":
        def _preload() -> None:
            def log(msg: str) -> None:
                print(log_line(msg))

            log(f"Preloading WhisperModel size={cfg.model_size}")
            start_model_download(cfg.model_size, log_fn=log)
            ok = preload_whisper_model(cfg.model_size, log)
            if ok:
                log("WhisperModel preload complete")
            else:
                log("WhisperModel preload failed or unavailable")

        threading.Thread(target=_preload, daemon=True).start()

    yield


app = FastAPI(title="plaud-stt-obsidian", lifespan=lifespan)

# Allow all origins for MVP; Tauri uses a custom origin anyway.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


# --- config endpoints ---

@app.get("/config")
def get_config() -> dict:
    cfg = load_config()
    return cfg.to_dict()


@app.post("/config")
def update_config(payload: dict) -> dict:
    cfg = AppConfig.from_dict(payload)
    save_config(cfg)
    set_config(cfg)
    return cfg.to_dict()


@app.get("/config/initialized")
def config_initialized() -> dict:
    cfg = load_config()
    return {"initialized": bool(cfg.initialized)}


@app.post("/config/initialize")
def config_initialize(payload: dict) -> dict:
    cfg = AppConfig.from_dict(payload)
    cfg.initialized = True
    save_config(cfg)
    set_config(cfg)
    return cfg.to_dict()


# --- model download endpoints ---

@app.get("/model/size")
def model_size(model_size: str) -> dict:
    try:
        size = get_model_size_bytes(model_size)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"bytes": int(size)}


@app.get("/model/download/status")
def model_download_status(model_size: str) -> dict:
    try:
        # UI polls this endpoint to render the progress bar.
        return get_download_status(model_size)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/model/download/start")
def model_download_start(payload: dict) -> dict:
    model_size = str(payload.get("model_size", "")).strip()
    if not model_size:
        raise HTTPException(status_code=400, detail="model_size is required")
    # Starting a download is idempotent; repeated calls return current status.
    try:
        return start_model_download(model_size)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# --- jobs endpoints ---

@app.post("/jobs")
def create_job(file: UploadFile = File(...)) -> dict:
    # Basic extension check; not a full mime validation.
    if not file.filename or not file.filename.lower().endswith(".mp3"):
        raise HTTPException(status_code=400, detail="Only .mp3 files are supported")

    data = file.file.read()
    job = create_job_from_upload(file.filename, data)
    return job.to_dict()


@app.get("/jobs")
def list_jobs_endpoint() -> list:
    return list_jobs()


@app.get("/jobs/{job_id}")
def get_job_endpoint(job_id: str) -> dict:
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job.to_dict()


@app.post("/jobs/{job_id}/cancel")
def cancel_job_endpoint(job_id: str) -> dict:
    ok = cancel_job(job_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"ok": True}


@app.post("/jobs/{job_id}/export/obsidian")
def export_job_endpoint(job_id: str) -> dict:
    try:
        path = export_job_to_obsidian(job_id)
        return {"ok": True, "path": str(path)}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Job not found")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/jobs/{job_id}/segments")
def get_segments_endpoint(job_id: str) -> list:
    try:
        return get_segments(job_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Segments not found")


@app.get("/jobs/{job_id}/summary")
def get_summary_endpoint(job_id: str) -> dict:
    # Separate endpoint keeps UI simple and avoids sending full job payload.
    try:
        return get_summary(job_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Summary not found")


@app.post("/jobs/{job_id}/summarize")
def summarize_job_endpoint(job_id: str) -> dict:
    # Manual regeneration may take time; we keep it synchronous for MVP simplicity.
    try:
        return summarize_job(job_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@app.get("/jobs/{job_id}/clip")
def get_clip(job_id: str, start: float, end: float):
    if end <= start:
        raise HTTPException(status_code=400, detail="Invalid time range")
    try:
        clip_path = create_clip(job_id, start, end)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Job not found")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # We return mp3 for compatibility with HTML audio element.
    return FileResponse(path=clip_path, media_type="audio/mpeg", filename=Path(clip_path).name)
