import pytest

from app.llm.summarize import (
    chunk_text,
    _prompt_for_reduce,
    summarize_transcript,
    SummarizationConfig,
    OllamaUnavailableError,
)


def test_chunk_text_respects_max_size():
    # Ensure chunking never exceeds max size even with repeated text.
    # Use small sizes to make the test fast and deterministic.
    text = "Абзац 1. " * 30 + "\n\n" + "Абзац 2. " * 30
    chunks = chunk_text(text, min_chars=50, max_chars=120)

    assert chunks, "Expected at least one chunk"
    assert all(len(c) <= 120 for c in chunks)


def test_reduce_prompt_includes_mini_summaries():
    # Reduce prompt must include all mini summaries so final output can be built correctly.
    mini = ["- Пункт 1", "- Пункт 2"]
    prompt = _prompt_for_reduce(mini)
    assert "Мини-сводки:" in prompt
    assert "- Пункт 1" in prompt
    assert "- Пункт 2" in prompt


def test_summarize_fallback_when_ollama_unavailable(monkeypatch):
    # If Ollama is not reachable, summarizer should raise a dedicated error.
    def fake_check_available(_base_url: str) -> bool:
        return False

    monkeypatch.setattr("app.llm.ollama_client.check_available", fake_check_available)

    cfg = SummarizationConfig(
        base_url="http://127.0.0.1:11434",
        model="qwen2.5:7b-instruct",
        enable=True,
        auto=True,
    )

    with pytest.raises(OllamaUnavailableError):
        summarize_transcript("Тестовый текст", cfg)
