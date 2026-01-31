"""Filesystem paths and helpers for backend storage."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

# NOTE: This file centralizes all paths to avoid magic directories spread across the codebase.

# Resolve backend/ directory even when code is executed from another working directory.
BACKEND_DIR = Path(__file__).resolve().parents[2]
INBOX_DIR = BACKEND_DIR / "inbox"
OUT_DIR = BACKEND_DIR / "out"
TMP_DIR = BACKEND_DIR / "tmp"


@dataclass(frozen=True)
class JobPaths:
    """Convenience bundle for job-specific paths."""

    job_dir: Path
    original_mp3: Path
    audio_wav: Path
    segments_json: Path
    transcript_txt: Path
    transcript_srt: Path
    md_preview: Path
    summary_md: Path
    summary_json: Path


def ensure_app_dirs() -> None:
    """Create base directories if missing.

    We keep this idempotent so tests and repeated startups are safe.
    """

    INBOX_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)


def job_paths(job_id: str) -> JobPaths:
    """Build all paths for a given job id.

    Keeping this in one place makes it easy to change the layout later.
    """

    job_dir = OUT_DIR / job_id
    return JobPaths(
        job_dir=job_dir,
        original_mp3=job_dir / "original.mp3",
        audio_wav=job_dir / "audio.wav",
        segments_json=job_dir / "segments.json",
        transcript_txt=job_dir / "transcript.txt",
        transcript_srt=job_dir / "transcript.srt",
        md_preview=job_dir / "md_preview.md",
    # Summary artifacts are stored separately so users can reuse them or inspect debugging metadata.
    # summary.md contains the Markdown Summary section, and summary.json holds status/metadata for UI/debugging.
        summary_md=job_dir / "summary.md",
        summary_json=job_dir / "summary.json",
    )


def ensure_job_dir(job_id: str) -> JobPaths:
    """Create job directory and return its paths."""

    paths = job_paths(job_id)
    paths.job_dir.mkdir(parents=True, exist_ok=True)
    return paths
