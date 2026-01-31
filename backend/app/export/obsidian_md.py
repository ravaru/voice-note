"""Obsidian Markdown export."""

from __future__ import annotations

from datetime import datetime
from typing import List, Dict

from app.pipeline.merge import segments_to_markdown_lines


def build_markdown(
    *,
    created_at: datetime,
    model_size: str,
    language: str,
    summary_language: str,
    summary_model: str,
    summary_md: str,
    audio_filename: str,
    job_id: str,
    segments: List[Dict[str, float | str]],
) -> str:
    """Generate Markdown with frontmatter + transcript list.

    Keeping export logic in one place ensures consistency across UI preview
    and actual Obsidian export.
    """

    created_str = created_at.strftime("%Y-%m-%d %H:%M")
    # Frontmatter is kept explicit and stable so downstream tools (Obsidian, scripts)
    # can parse key fields like model and summary metadata.
    frontmatter = [
        "---",
        f"created: {created_str}",
        "source: plaud",
        f"language: {language}",
        f"summary_language: {summary_language}",
        f"whisper_model: {model_size}",
        f"llm_summary_model: {summary_model}",
        f"audio_file: {audio_filename}",
        f"job_id: {job_id}",
        "---",
        "",
        "## Расшифровка",
    ]

    transcript_lines = segments_to_markdown_lines(segments)
    if not transcript_lines:
        transcript_lines = ["- (пусто)"]

    # Summary is already Markdown with heading; we insert it between Transcript and Notes.
    # If Summary is empty for any reason, we fall back to the standard placeholder to
    # avoid producing a broken or missing Summary section in exported notes.
    summary_block = summary_md.strip()
    if not summary_block:
        summary_block = "## Summary\n— Не сгенерировано (Ollama недоступен или выключен)"

    notes = ["", "## Заметки", ""]

    return "\n".join(frontmatter + transcript_lines + ["", summary_block] + notes)
