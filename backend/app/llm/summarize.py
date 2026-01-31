"""Transcript summarization (map-reduce) using Ollama.

We keep the prompts short and strict to reduce hallucinations, and we always
force Russian output per product requirements.
"""

from __future__ import annotations

from dataclasses import dataclass
import time
from typing import List, Optional

from app.llm import ollama_client


class OllamaUnavailableError(RuntimeError):
    """Raised when Ollama is not reachable."""


class SummarizationError(RuntimeError):
    """Raised when Ollama returns invalid output or other failures occur."""


@dataclass
class SummarizationConfig:
    """All knobs used by the summarizer.

    Keeping these in one struct makes it easier to pass config through the
    pipeline and to test edge cases.
    """

    base_url: str
    model: str
    enable: bool
    auto: bool
    temperature: float = 0.15
    top_p: float = 0.9
    repeat_penalty: float = 1.12
    num_predict: int = 900
    timeout_sec: float = 90.0
    retry_count: int = 1
    min_chunk_chars: int = 3000
    max_chunk_chars: int = 6000
    prompt_template: str = ""


SUMMARY_TEMPLATE = """## Summary
### Коротко (TL;DR)
- — Не зафиксировано

### Ключевые тезисы
- — Не зафиксировано

### Решения
- — Не зафиксировано

### Действия (action items)
- [ ] — Не зафиксировано

### Открытые вопросы
- — Не зафиксировано
"""


def _normalize_text(text: str) -> str:
    """Normalize transcript text before chunking.

    We trim whitespace and collapse repeated spaces to keep the prompt size
    predictable, while preserving paragraph boundaries.
    """

    lines = [line.strip() for line in text.splitlines()]
    return "\n".join(lines).strip()


def chunk_text(text: str, min_chars: int = 3000, max_chars: int = 6000) -> List[str]:
    """Split text into reasonably sized chunks for map-reduce.

    Strategy:
    - Prefer paragraph boundaries (double newlines).
    - If a single paragraph is too long, fall back to sentence-ish splitting.
    - Always cap chunks at max_chars to avoid timeouts.
    """

    clean = _normalize_text(text)
    if not clean:
        return []

    paragraphs = [p for p in clean.split("\n\n") if p.strip()]
    chunks: List[str] = []
    current = ""

    def _flush() -> None:
        nonlocal current
        if current.strip():
            chunks.append(current.strip())
        current = ""

    for para in paragraphs:
        # If paragraph alone is bigger than max, split by sentences.
        if len(para) > max_chars:
            sentences = [s.strip() for s in para.replace("\n", " ").split(". ") if s.strip()]
            for s in sentences:
                candidate = (current + " " + s).strip()
                if len(candidate) > max_chars and current:
                    _flush()
                    current = s
                else:
                    current = candidate
            _flush()
            continue

        candidate = (current + "\n\n" + para).strip() if current else para
        if len(candidate) > max_chars and current:
            _flush()
            current = para
        else:
            current = candidate

        # If we already have enough content, flush to keep chunks balanced.
        if len(current) >= min_chars:
            _flush()

    _flush()
    return chunks


def _prompt_for_chunk(text: str) -> str:
    """Prompt used for map step.

    We ask for short bullet points only, so the reduce step can build a full
    summary template.
    """

    return (
        "Ты помогаешь сделать суммаризацию по расшифровке.\n"
        "Пиши только по-русски. Не выдумывай фактов.\n"
        "Если данных нет — пиши '— Не зафиксировано'.\n"
        "Верни краткие пункты (буллеты), без заголовков.\n"
        "Текст:\n"
        f"{text}\n"
    )


def _prompt_for_reduce(mini_summaries: List[str]) -> str:
    """Prompt used for reduce step to build the final Markdown template."""

    joined = "\n".join(mini_summaries)
    return (
        "Собери финальное Summary по мини-сводкам ниже.\n"
        "Пиши только по-русски. Не выдумывай. Если данных нет — '— Не зафиксировано'.\n"
        "Верни ТОЛЬКО Markdown по шаблону ниже и ничего лишнего.\n"
        "Шаблон:\n"
        "## Summary\n"
        "### Коротко (TL;DR)\n"
        "- ...\n\n"
        "### Ключевые тезисы\n"
        "- ...\n\n"
        "### Решения\n"
        "- ... (если нет — '— Не зафиксировано')\n\n"
        "### Действия (action items)\n"
        "- [ ] ... (если нет — '— Не зафиксировано')\n\n"
        "### Открытые вопросы\n"
        "- ... (если нет — '— Не зафиксировано')\n"
        "Мини-сводки:\n"
        f"{joined}\n"
    )


def _prompt_for_full(text: str) -> str:
    """Prompt used when the transcript fits in a single chunk."""

    return (
        "Сделай Summary по расшифровке.\n"
        "Пиши только по-русски. Не выдумывай фактов.\n"
        "Если данных нет — '— Не зафиксировано'.\n"
        "Верни ТОЛЬКО Markdown по шаблону ниже и ничего лишнего.\n"
        "Шаблон:\n"
        "## Summary\n"
        "### Коротко (TL;DR)\n"
        "- ...\n\n"
        "### Ключевые тезисы\n"
        "- ...\n\n"
        "### Решения\n"
        "- ... (если нет — '— Не зафиксировано')\n\n"
        "### Действия (action items)\n"
        "- [ ] ... (если нет — '— Не зафиксировано')\n\n"
        "### Открытые вопросы\n"
        "- ... (если нет — '— Не зафиксировано')\n"
        "Текст:\n"
        f"{text}\n"
    )


def _build_prompt(template: str, text: str, summaries: Optional[List[str]] = None) -> str:
    """Build prompt from a user template.

    Supports {text} for raw transcript and {summaries} for reduce step.
    If placeholders are missing, we append the relevant content.
    """

    prompt = template.strip()
    if "{summaries}" in prompt and summaries is not None:
        prompt = prompt.replace("{summaries}", "\n".join(summaries))
    elif summaries is not None:
        prompt = f"{prompt}\nМини-сводки:\n" + "\n".join(summaries)

    if "{text}" in prompt:
        prompt = prompt.replace("{text}", text)
    elif text:
        prompt = f"{prompt}\nТекст:\n{text}\n"

    return prompt


def _call_ollama(prompt: str, cfg: SummarizationConfig) -> str:
    """Call Ollama with retries and consistent options."""

    last_error: Optional[Exception] = None
    for attempt in range(cfg.retry_count + 1):
        try:
            return ollama_client.generate(
                base_url=cfg.base_url,
                model=cfg.model,
                prompt=prompt,
                temperature=cfg.temperature,
                top_p=cfg.top_p,
                repeat_penalty=cfg.repeat_penalty,
                num_predict=cfg.num_predict,
                timeout_sec=cfg.timeout_sec,
            )
        except Exception as exc:
            last_error = exc
            if attempt < cfg.retry_count:
                time.sleep(1.0)
            continue

    raise SummarizationError(f"Ollama generation failed: {last_error}")


def summarize_transcript(text: str, cfg: SummarizationConfig) -> str:
    """Summarize transcript text using Ollama.

    Returns:
        Markdown string containing the Summary section.
    """

    # If summarization is disabled at config level, skip early.
    if not cfg.enable:
        return "## Summary\n— Не сгенерировано (Ollama недоступен или выключен)\n"

    # Check Ollama availability before spending time on chunking.
    if not ollama_client.check_available(cfg.base_url):
        raise OllamaUnavailableError("Ollama not available")

    clean = _normalize_text(text)
    if not clean:
        return SUMMARY_TEMPLATE

    chunks = chunk_text(clean, cfg.min_chunk_chars, cfg.max_chunk_chars)
    if len(chunks) <= 1:
        prompt = (
            _build_prompt(cfg.prompt_template, clean)
            if cfg.prompt_template
            else _prompt_for_full(clean)
        )
        return _call_ollama(prompt, cfg).strip()

    # Map step: generate mini summaries per chunk.
    mini_summaries = []
    for chunk in chunks:
        mini_summaries.append(_call_ollama(_prompt_for_chunk(chunk), cfg).strip())

    # Reduce step: build final summary in strict template.
    reduce_prompt = (
        _build_prompt(cfg.prompt_template, "", mini_summaries)
        if cfg.prompt_template
        else _prompt_for_reduce(mini_summaries)
    )
    return _call_ollama(reduce_prompt, cfg).strip()
