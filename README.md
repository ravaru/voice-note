# VoiceNote

Локальное desktop-приложение для транскрибации MP3/M4A/WAV и экспорта в Obsidian. MVP ориентирован на macOS Apple Silicon. Всё работает локально: аудио, модели и результаты не уходят в сеть.

## Документация пользователя

См. `USER_GUIDE.md`.

## Архитектура

- **UI**: Tauri v2 + React + TypeScript (`ui/`).
- **Backend**: FastAPI (Python 3.11+) (`backend/`).
- **Связь**: UI делает HTTP-запросы к backend (`http://127.0.0.1:8765`).
- **Очередь**: один фоновой воркер обрабатывает jobs последовательно.
- **Объекты**:
  - `Job` хранится в памяти + артефакты в `backend/out/<job_id>/`.
  - Конфиг хранится в `backend/config.toml`.

## Pipeline

1. **Upload**: MP3/M4A/WAV попадает в очередь (`POST /jobs`), сохраняется как `backend/out/<job_id>/original.<ext>`.
2. **Convert**: `ffmpeg` -> `audio.wav` (16kHz, mono).
3. **VAD**: silero-vad создаёт временные чанки речи (pad 0.2s, merge gap < 0.6s, max 35s).
4. **Transcribe**: faster-whisper по каждому чанку, время сегментов приводится к абсолютному.
5. **Merge**: сборка `segments.json`, `transcript.txt`, `transcript.srt`.
6. **Summarize (optional)**: локальная суммаризация через Ollama (RU).
7. **Markdown**: сборка `md_preview` (Transcript + Summary).
8. **Export**: по кнопке экспорт в Obsidian (Markdown, выбранные jobs).

## Структура выходных данных

`backend/out/<job_id>/`:
- `original.mp3`
- `audio.wav`
- `segments.json`
- `transcript.txt`
- `transcript.srt`
- `summary.md`
- `summary.json`
- `md_preview.md`

## Установка

### Требования
- Rust (для Tauri)
- Node.js (рекомендуется LTS)
- Python 3.11+
- ffmpeg (через Homebrew)

```bash
brew install ffmpeg
```

### Setup

```bash
make setup
```

## Запуск

```bash
make backend
```

В отдельном терминале:

```bash
make ui
```

## Конфиг Obsidian

- При первом запуске открывается Wizard.
- Укажите путь к vault и подпапку (default: `Transcripts`).
- Настройки можно изменить в `Settings`.

## Локальная суммаризация (Ollama)

- По умолчанию включена и выполняется после транскрибации.
- Используется локальный Ollama API (`http://127.0.0.1:11434`).
- Модель по умолчанию: `qwen2.5:7b-instruct`.
- Если Ollama недоступен, job не падает, summary помечается как `skipped`.

## Тесты

```bash
make test
```

Что проверяется:
- **Unit tests**: форматирование времени, генерация Markdown, chunking summary.
- **Smoke test**: health-check и базовая целостность pipeline (без реального whisper/ffmpeg и без реального Ollama).

Smoke test **не** проверяет качество распознавания — только наличие артефактов и отсутствие ошибок в цепочке.

## Watch Folder (inbox)

- Backend watches `backend/inbox/` when `watch_inbox_enabled=true`.
- New `.mp3` files are auto-enqueued and moved into `backend/out/<job_id>/original.mp3`.

## Troubleshooting

- **Порт 8765 занят**: остановите процесс или поменяйте порт в `backend/app/config.py` и `ui/src/api/client.ts`.
- **ffmpeg не найден**: установите `brew install ffmpeg`.
- **Нет прав на запись в vault**: убедитесь, что приложению разрешён доступ к каталогу Obsidian.
- **Медленно/падает при первой загрузке silero-vad**: требуется загрузка модели (может занять время).
- **Summary не создаётся**: проверьте, что Ollama запущен и доступен по `ollama_base_url`.

## Безопасность и приватность

- Всё происходит локально: аудио, текст и файлы остаются на компьютере.
- Сеть не используется для отправки данных.
