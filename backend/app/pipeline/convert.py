"""Audio conversion utilities."""

from __future__ import annotations

import os
import subprocess
import wave
from pathlib import Path


def _write_silence_wav(path: Path, seconds: float = 1.0, sample_rate: int = 16000) -> None:
    """Create a silent WAV file for tests.

    This avoids depending on ffmpeg during unit/smoke tests.
    """

    n_frames = int(seconds * sample_rate)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        wf.writeframes(b"\x00\x00" * n_frames)


def convert_mp3_to_wav(
    input_mp3: Path,
    output_wav: Path,
    log_fn,
    cancel_check,
) -> None:
    """Convert MP3 to 16kHz mono WAV using ffmpeg.

    In test mode we generate a tiny silent WAV instead of invoking ffmpeg.
    """

    if cancel_check():
        raise RuntimeError("cancelled")

    # Ensure parent directory exists for output.
    output_wav.parent.mkdir(parents=True, exist_ok=True)

    # Test mode: bypass ffmpeg to keep tests pure Python.
    if os.getenv("PLAUD_TEST_MODE") == "1":
        log_fn("Convert skipped (test mode). Writing silent WAV.")
        _write_silence_wav(output_wav)
        return

    cmd = [
        "ffmpeg",
        "-y",  # overwrite
        "-i",
        str(input_mp3),
        "-ac",
        "1",  # mono
        "-ar",
        "16000",  # 16kHz
        "-vn",
        str(output_wav),
    ]

    log_fn(f"Running ffmpeg convert: {' '.join(cmd)}")

    # We capture stderr for logging in case of failure.
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        log_fn(f"ffmpeg error: {result.stderr.strip()}")
        raise RuntimeError("ffmpeg convert failed")

    if cancel_check():
        raise RuntimeError("cancelled")
