"""Model download helpers for faster-whisper."""

from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from threading import Lock, Thread
import time
from typing import Dict

MODEL_REPOS = {
    "tiny": "Systran/faster-whisper-tiny",
    "small": "Systran/faster-whisper-small",
    "medium": "Systran/faster-whisper-medium",
    "large-v3": "Systran/faster-whisper-large-v3",
}

_SIZE_CACHE: Dict[str, int] = {}
_STATUS_LOCK = Lock()


@dataclass
class DownloadStatus:
    state: str = "idle"  # idle | downloading | done | error
    model_size: str = ""
    repo_id: str = ""
    total_bytes: int = 0
    downloaded_bytes: int = 0
    message: str = ""
    started_at: float = 0.0
    finished_at: float = 0.0

    def to_dict(self) -> dict:
        return asdict(self)


_STATUS = DownloadStatus()


def _repo_for_size(model_size: str) -> str:
    repo = MODEL_REPOS.get(model_size)
    if not repo:
        raise ValueError(f"Unsupported model size: {model_size}")
    return repo


def get_model_size_bytes(model_size: str) -> int:
    cached = _SIZE_CACHE.get(model_size)
    if cached:
        return cached
    repo_id = _repo_for_size(model_size)
    try:
        from huggingface_hub import HfApi  # type: ignore

        info = HfApi().model_info(repo_id, files_metadata=True)
        total = 0
        for sibling in getattr(info, "siblings", []) or []:
            size = getattr(sibling, "size", None)
            if isinstance(size, int):
                total += size
        if total > 0:
            _SIZE_CACHE[model_size] = total
        return total
    except Exception:
        return 0


def _set_status(**kwargs) -> None:
    with _STATUS_LOCK:
        for key, value in kwargs.items():
            setattr(_STATUS, key, value)


def get_download_status(model_size: str) -> dict:
    repo_id = _repo_for_size(model_size)
    with _STATUS_LOCK:
        current = _STATUS
        if current.model_size == model_size and current.state in ("downloading", "done", "error"):
            return current.to_dict()

    total = get_model_size_bytes(model_size)
    return DownloadStatus(
        state="idle",
        model_size=model_size,
        repo_id=repo_id,
        total_bytes=total,
        downloaded_bytes=0,
        message="",
    ).to_dict()


def start_model_download(model_size: str, log_fn=None) -> dict:
    repo_id = _repo_for_size(model_size)
    with _STATUS_LOCK:
        if _STATUS.state == "downloading":
            return _STATUS.to_dict()
        _STATUS.state = "downloading"
        _STATUS.model_size = model_size
        _STATUS.repo_id = repo_id
        _STATUS.total_bytes = get_model_size_bytes(model_size)
        _STATUS.downloaded_bytes = 0
        _STATUS.message = ""
        _STATUS.started_at = time.time()
        _STATUS.finished_at = 0.0

    def _worker() -> None:
        try:
            from huggingface_hub import HfApi, hf_hub_download  # type: ignore
            from huggingface_hub.constants import HF_HUB_CACHE  # type: ignore
            try:
                from huggingface_hub.file_download import repo_folder_name  # type: ignore
            except Exception:
                repo_folder_name = None

            with _STATUS_LOCK:
                total_bytes = _STATUS.total_bytes

            repo_folder = None
            if repo_folder_name:
                try:
                    repo_folder = repo_folder_name(repo_id=repo_id, repo_type="model")
                except Exception:
                    repo_folder = None
            if not repo_folder:
                repo_folder = f"models--{repo_id.replace('/', '--')}"

            blobs_dir = Path(HF_HUB_CACHE) / repo_folder / "blobs"

            def _dir_size(path: Path) -> int:
                if not path.exists():
                    return 0
                total = 0
                for entry in path.iterdir():
                    try:
                        if entry.is_file():
                            total += entry.stat().st_size
                    except Exception:
                        pass
                return total

            def _monitor() -> None:
                last = 0
                while True:
                    with _STATUS_LOCK:
                        if _STATUS.state != "downloading":
                            break
                        current_total = _STATUS.total_bytes
                    size = _dir_size(blobs_dir)
                    if current_total > 0:
                        size = min(size, current_total)
                    if size > last:
                        _set_status(downloaded_bytes=size)
                        last = size
                    time.sleep(1)

            Thread(target=_monitor, daemon=True).start()

            info = HfApi().model_info(repo_id, files_metadata=True)
            files = []
            for sibling in getattr(info, "siblings", []) or []:
                filename = getattr(sibling, "rfilename", None) or getattr(sibling, "path", None)
                size = getattr(sibling, "size", None)
                if filename:
                    files.append((filename, size))

            known_total = sum(size for _, size in files if isinstance(size, int))
            if known_total > 0:
                total_bytes = known_total
                _set_status(total_bytes=known_total)

            downloaded = 0
            for filename, size in files:
                path = hf_hub_download(repo_id, filename, resume_download=True)
                if isinstance(size, int):
                    downloaded += size
                else:
                    try:
                        downloaded += Path(path).stat().st_size
                    except Exception:
                        pass
                _set_status(downloaded_bytes=downloaded)

            total = total_bytes or downloaded
            _set_status(
                state="done",
                total_bytes=total,
                downloaded_bytes=downloaded,
                finished_at=time.time(),
            )
            if log_fn:
                log_fn(f"Model download complete ({downloaded} bytes)")
        except Exception as exc:
            _set_status(state="error", message=str(exc), finished_at=time.time())
            if log_fn:
                log_fn(f"Model download failed: {exc}")

    Thread(target=_worker, daemon=True).start()
    return get_download_status(model_size)
