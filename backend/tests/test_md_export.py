from datetime import datetime
from app.export.obsidian_md import build_markdown


def test_build_markdown_contains_frontmatter_and_transcript():
    # Summary is expected to be embedded between Transcript and Notes.
    md = build_markdown(
        created_at=datetime(2024, 1, 1, 12, 0),
        model_size="small",
        language="ru",
        summary_language="ru",
        summary_model="qwen2.5:7b-instruct",
        summary_md="## Summary\n— Не сгенерировано (Ollama недоступен или выключен)\n",
        audio_filename="test.mp3",
        job_id="abc123",
        segments=[{"start": 3.2, "end": 5.0, "text": "Привет"}],
    )

    assert "created: 2024-01-01 12:00" in md
    assert "whisper_model: small" in md
    assert "summary_language: ru" in md
    assert "llm_summary_model: qwen2.5:7b-instruct" in md
    assert "audio_file: test.mp3" in md
    assert "job_id: abc123" in md
    assert "## Расшифровка" in md
    assert "- 00:00:03 — Привет" in md
    assert "## Summary" in md
    assert "## Заметки" in md
