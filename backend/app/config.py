"""Config management for the backend.

The config is stored in backend/config.toml to keep everything local.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path

# tomllib is available in Python 3.11+. For 3.9/3.10 we fallback to tomli.
try:
    import tomllib  # type: ignore
except ModuleNotFoundError:  # pragma: no cover - only hit on older Python
    import tomli as tomllib  # type: ignore

from app.util.paths import BACKEND_DIR

CONFIG_PATH = BACKEND_DIR / "config.toml"


@dataclass
class AppConfig:
    initialized: bool = False
    vault_path: str = ""
    output_subfolder: str = "Transcripts"
    model_size: str = "small"  # "tiny", "small", "medium", or "large-v3"
    preload_model: bool = False
    language: str = "ru"
    # Summarization settings (Ollama, local).
    # enable_summarization controls whether we ever call Ollama at all.
    # auto_summarize_after_transcription decides if we run summary as part of the pipeline,
    # but manual "Regenerate summary" can still run when enabled.
    enable_summarization: bool = True
    auto_summarize_after_transcription: bool = True
    # ollama_base_url and ollama_model are stored in config so the UI can control them.
    # Defaults align with local Ollama installation and a strong RU-capable instruct model.
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "qwen2.5:7b-instruct"
    include_timestamps: bool = True
    watch_inbox_enabled: bool = False
    inbox_poll_seconds: int = 8

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "AppConfig":
        # Be defensive: missing keys should fall back to defaults.
        return cls(
            initialized=bool(data.get("initialized", False)),
            vault_path=str(data.get("vault_path", "")),
            output_subfolder=str(data.get("output_subfolder", "Transcripts")),
            model_size=str(data.get("model_size", "small")),
            preload_model=bool(data.get("preload_model", False)),
            language=str(data.get("language", "ru")),
            enable_summarization=bool(data.get("enable_summarization", True)),
            auto_summarize_after_transcription=bool(
                data.get("auto_summarize_after_transcription", True)
            ),
            ollama_base_url=str(data.get("ollama_base_url", "http://127.0.0.1:11434")),
            ollama_model=str(data.get("ollama_model", "qwen2.5:7b-instruct")),
            include_timestamps=bool(data.get("include_timestamps", True)),
            watch_inbox_enabled=bool(data.get("watch_inbox_enabled", False)),
            inbox_poll_seconds=int(data.get("inbox_poll_seconds", 8)),
        )


def load_config() -> AppConfig:
    if not CONFIG_PATH.exists():
        return AppConfig()

    # tomllib is available in Python 3.11+.
    with CONFIG_PATH.open("rb") as f:
        data = tomllib.load(f)
    return AppConfig.from_dict(data)


def save_config(cfg: AppConfig) -> None:
    """Persist config to TOML.

    We keep the writer minimal to avoid additional dependencies.
    """

    lines = [
        f"initialized = {'true' if cfg.initialized else 'false'}",
        f"vault_path = {cfg.vault_path!r}",
        f"output_subfolder = {cfg.output_subfolder!r}",
        f"model_size = {cfg.model_size!r}",
        f"preload_model = {'true' if cfg.preload_model else 'false'}",
        f"language = {cfg.language!r}",
        # Summarization fields are persisted so UI changes survive restarts.
        f"enable_summarization = {'true' if cfg.enable_summarization else 'false'}",
        f"auto_summarize_after_transcription = {'true' if cfg.auto_summarize_after_transcription else 'false'}",
        f"ollama_base_url = {cfg.ollama_base_url!r}",
        f"ollama_model = {cfg.ollama_model!r}",
        f"include_timestamps = {'true' if cfg.include_timestamps else 'false'}",
        f"watch_inbox_enabled = {'true' if cfg.watch_inbox_enabled else 'false'}",
        f"inbox_poll_seconds = {int(cfg.inbox_poll_seconds)}",
    ]
    CONFIG_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
