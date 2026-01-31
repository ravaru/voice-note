"""Merge transcript segments into text and SRT outputs."""

from __future__ import annotations

from typing import List, Dict

from app.util.timefmt import format_hhmmss, format_srt_timestamp


def segments_to_text(segments: List[Dict[str, float | str]]) -> str:
    # Join with spaces to build a readable transcript.
    return " ".join(str(seg["text"]).strip() for seg in segments if str(seg["text"]).strip())


def segments_to_srt(segments: List[Dict[str, float | str]]) -> str:
    lines = []
    counter = 1
    for seg in segments:
        start = format_srt_timestamp(float(seg["start"]))
        end = format_srt_timestamp(float(seg["end"]))
        text = str(seg["text"]).strip()
        if not text:
            continue
        lines.append(str(counter))
        lines.append(f"{start} --> {end}")
        lines.append(text)
        lines.append("")
        counter += 1
    return "\n".join(lines).strip() + "\n"


def segments_to_markdown_lines(segments: List[Dict[str, float | str]]) -> List[str]:
    # Each line: - HH:MM:SS — text
    lines = []
    for seg in segments:
        ts = format_hhmmss(float(seg["start"]))
        text = str(seg["text"]).strip()
        if text:
            lines.append(f"- {ts} — {text}")
    return lines
