"""Time formatting helpers for transcripts and UI."""

from __future__ import annotations

from math import floor

# Keeping all time formatting in one place helps keep output consistent across formats.


def _clamp_seconds(seconds: float) -> float:
    # Negative timestamps are not meaningful for playback or captions.
    return max(0.0, float(seconds))


def format_hhmmss(seconds: float) -> str:
    """Format seconds as HH:MM:SS (no milliseconds).

    Used for Markdown timestamps. We intentionally floor to full seconds so UI
    and Obsidian stay clean and stable.
    """

    total = floor(_clamp_seconds(seconds))
    hours = total // 3600
    minutes = (total % 3600) // 60
    secs = total % 60
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def format_srt_timestamp(seconds: float) -> str:
    """Format seconds as SRT timestamp HH:MM:SS,mmm."""

    s = _clamp_seconds(seconds)
    hours = int(s // 3600)
    minutes = int((s % 3600) // 60)
    secs = int(s % 60)
    millis = int(round((s - floor(s)) * 1000))

    # Guard against rounding reaching 1000 ms.
    if millis >= 1000:
        millis = 0
        secs += 1
        if secs >= 60:
            secs = 0
            minutes += 1
            if minutes >= 60:
                minutes = 0
                hours += 1

    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"
