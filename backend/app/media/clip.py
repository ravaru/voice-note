"""Create temporary audio clips for playback."""

from __future__ import annotations

import time
import uuid
import subprocess
from pathlib import Path

# Clip TTL in seconds: keep short to avoid uncontrolled disk usage.
DEFAULT_CLIP_TTL_SECONDS = 10 * 60


def _cleanup_tmp(tmp_dir: Path, ttl_seconds: int) -> None:
    """Remove tmp files older than TTL.

    We do this on each clip request to keep logic simple.
    """

    now = time.time()
    for p in tmp_dir.glob("clip_*.mp3"):
        try:
            if now - p.stat().st_mtime > ttl_seconds:
                p.unlink(missing_ok=True)
        except Exception:
            # Best-effort cleanup; avoid breaking clip request.
            pass


def create_clip_mp3(
    source_mp3: Path,
    start: float,
    end: float,
    tmp_dir: Path,
    ttl_seconds: int = DEFAULT_CLIP_TTL_SECONDS,
) -> Path:
    """Create an mp3 clip file using ffmpeg.

    We re-encode to avoid issues with non-keyframe cuts in MP3.
    """

    start = max(0.0, float(start))
    end = float(end)
    if end <= start:
        raise RuntimeError("invalid clip range")

    tmp_dir.mkdir(parents=True, exist_ok=True)
    _cleanup_tmp(tmp_dir, ttl_seconds)

    clip_path = tmp_dir / f"clip_{uuid.uuid4().hex}.mp3"

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(source_mp3),
        "-ss",
        str(start),
        "-to",
        str(end),
        "-acodec",
        "libmp3lame",
        str(clip_path),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        # Provide stderr to help troubleshoot.
        raise RuntimeError(f"ffmpeg clip failed: {result.stderr.strip()}")

    return clip_path
