import React, { useEffect, useState } from "react";
import {
  getConfig,
  updateConfig,
  getModelSize,
  getModelDownloadStatus,
  startModelDownload,
} from "../api/client";
import type { AppConfig, ModelDownloadStatus } from "../api/types";

export default function Settings() {
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [modelSizeBytes, setModelSizeBytes] = useState<number | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<ModelDownloadStatus | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    getConfig().then(setCfg);
  }, []);

  useEffect(() => {
    // Refresh model size and download status when model changes.
    if (!cfg) return;
    getModelSize(cfg.model_size)
      .then((bytes) => setModelSizeBytes(bytes))
      .catch(() => setModelSizeBytes(null));
    getModelDownloadStatus(cfg.model_size)
      .then(setDownloadStatus)
      .catch(() => setDownloadStatus(null));
  }, [cfg?.model_size]);

  useEffect(() => {
    // Poll download progress while a model download is active.
    if (!cfg || downloadStatus?.state !== "downloading") return;
    const timer = setInterval(() => {
      getModelDownloadStatus(cfg.model_size)
        .then(setDownloadStatus)
        .catch(() => {});
    }, 1000);
    return () => clearInterval(timer);
  }, [cfg?.model_size, downloadStatus?.state]);

  if (!cfg) {
    return <div>Загрузка настроек…</div>;
  }

  const save = async () => {
    setStatus(null);
    try {
      const updated = await updateConfig(cfg);
      setCfg(updated);
      setStatus("Сохранено");
    } catch {
      setStatus("Не удалось сохранить");
    }
  };

  const startDownload = async () => {
    // Trigger backend-side download; UI will poll progress via status endpoint.
    setDownloadError(null);
    try {
      const next = await startModelDownload(cfg.model_size);
      setDownloadStatus(next);
    } catch {
      setDownloadError("Не удалось начать скачивание модели");
    }
  };

  const formatBytes = (bytes: number | null): string => {
    // Simple human-friendly formatter for sizes in the UI.
    if (!bytes || bytes <= 0) return "—";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let idx = 0;
    while (value >= 1024 && idx < units.length - 1) {
      value /= 1024;
      idx += 1;
    }
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[idx]}`;
  };

  const sizeBytes =
    downloadStatus?.total_bytes && downloadStatus.total_bytes > 0
      ? downloadStatus.total_bytes
      : modelSizeBytes;

  return (
    <div>
      <h3>Настройки</h3>

      <div style={{ marginBottom: 8 }}>
        <label>
          Путь к хранилищу:
          <input
            style={{ width: "100%" }}
            value={cfg.vault_path}
            onChange={(e) => setCfg({ ...cfg, vault_path: e.target.value })}
          />
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>
          Подпапка вывода:
          <input
            value={cfg.output_subfolder}
            onChange={(e) => setCfg({ ...cfg, output_subfolder: e.target.value })}
          />
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>
          Размер модели:
          <select
            value={cfg.model_size}
            onChange={(e) =>
              setCfg({
                ...cfg,
                model_size: e.target.value as "tiny" | "small" | "medium" | "large-v3",
              })
            }
          >
            <option value="tiny">tiny</option>
            <option value="small">small</option>
            <option value="medium">medium</option>
            <option value="large-v3">large-v3</option>
          </select>
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>
          Язык распознавания:
          <select
            value={cfg.language ?? "ru"}
            onChange={(e) => setCfg({ ...cfg, language: e.target.value })}
          >
            <option value="ru">RU</option>
          </select>
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>
          <input
            type="checkbox"
            checked={cfg.enable_summarization ?? true}
            onChange={(e) =>
              setCfg({ ...cfg, enable_summarization: e.target.checked })
            }
          />{" "}
          Включить суммаризацию (Ollama)
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>
          <input
            type="checkbox"
            checked={cfg.auto_summarize_after_transcription ?? true}
            onChange={(e) =>
              setCfg({
                ...cfg,
                auto_summarize_after_transcription: e.target.checked,
              })
            }
            disabled={!cfg.enable_summarization}
          />{" "}
          Автоматически суммаризировать после расшифровки
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>
          Ollama model:
          <input
            value={cfg.ollama_model ?? "qwen2.5:7b-instruct"}
            onChange={(e) => setCfg({ ...cfg, ollama_model: e.target.value })}
            style={{ marginLeft: 8 }}
          />
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>
          Ollama base URL:
          <input
            value={cfg.ollama_base_url ?? "http://127.0.0.1:11434"}
            onChange={(e) => setCfg({ ...cfg, ollama_base_url: e.target.value })}
            style={{ marginLeft: 8, width: "60%" }}
          />
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>
          <input
            type="checkbox"
            checked={cfg.preload_model ?? false}
            onChange={(e) => setCfg({ ...cfg, preload_model: e.target.checked })}
          />{" "}
          Предзагружать модель при запуске
        </label>
      </div>

      <div style={{ marginBottom: 16, padding: 12, border: "1px solid #ddd" }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Whisper модель</div>
        <div style={{ marginBottom: 6 }}>
          Размер: {formatBytes(sizeBytes)}
        </div>
        {downloadStatus?.state === "downloading" && sizeBytes ? (
          <div style={{ marginBottom: 6 }}>
            <progress
              value={downloadStatus.downloaded_bytes}
              max={sizeBytes}
              style={{ width: "100%" }}
            />
            <div style={{ fontSize: 12 }}>
              {formatBytes(downloadStatus.downloaded_bytes)} / {formatBytes(sizeBytes)}
            </div>
          </div>
        ) : null}
        {downloadStatus?.state === "done" && (
          <div style={{ fontSize: 12 }}>Модель скачана.</div>
        )}
        {downloadStatus?.state === "error" && (
          <div style={{ fontSize: 12, color: "red" }}>
            Ошибка скачивания: {downloadStatus.message || "неизвестно"}
          </div>
        )}
        {downloadError && (
          <div style={{ fontSize: 12, color: "red" }}>{downloadError}</div>
        )}
        <button
          onClick={startDownload}
          disabled={downloadStatus?.state === "downloading"}
        >
          Скачать модель
        </button>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>
          <input
            type="checkbox"
            checked={cfg.include_timestamps}
            onChange={(e) => setCfg({ ...cfg, include_timestamps: e.target.checked })}
          />{" "}
          Показывать метки времени
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>
          <input
            type="checkbox"
            checked={cfg.watch_inbox_enabled}
            onChange={(e) => setCfg({ ...cfg, watch_inbox_enabled: e.target.checked })}
          />{" "}
          Отслеживать папку inbox (backend/inbox/)
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>
          Интервал опроса inbox (сек.):
          <input
            type="number"
            value={cfg.inbox_poll_seconds}
            onChange={(e) =>
              setCfg({ ...cfg, inbox_poll_seconds: Number(e.target.value) })
            }
          />
        </label>
      </div>

      <button onClick={save}>Сохранить</button>
      {status && <div style={{ marginTop: 8 }}>{status}</div>}
    </div>
  );
}
