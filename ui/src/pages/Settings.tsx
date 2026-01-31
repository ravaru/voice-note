import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  getConfig,
  updateConfig,
  getModelSize,
  getModelDownloadStatus,
  startModelDownload,
} from "../api/client";
import type { AppConfig, ModelDownloadStatus } from "../api/types";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import ProgressBar from "../components/ui/ProgressBar";
import Tabs from "../components/tabs/Tabs";
import { useI18n } from "../i18n/I18nProvider";
import { SUPPORTED_LOCALES } from "../i18n/strings";

const DEFAULT_SUMMARY_PROMPT = `Сделай Summary по расшифровке.
Пиши только по-русски. Не выдумывай фактов.
Если данных нет — '— Не зафиксировано'.
Верни ТОЛЬКО Markdown по шаблону ниже и ничего лишнего.
Шаблон:
## Summary
### Коротко (TL;DR)
- ...

### Ключевые тезисы
- ...

### Решения
- ... (если нет — '— Не зафиксировано')

### Действия (action items)
- [ ] ... (если нет — '— Не зафиксировано')

### Открытые вопросы
- ... (если нет — '— Не зафиксировано')
Текст:
{text}
`;

const PROMPT_STORAGE_KEY = "voicenote.summary_prompt";
const getDefaultLanguage = (): "ru" | "en" => {
  const system = navigator.language?.toLowerCase() ?? "en";
  return system.startsWith("ru") ? "ru" : "en";
};

export type SettingsHandle = {
  save: () => void;
  isDirty: () => boolean;
};

type Props = {
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: (cfg: AppConfig) => void;
};

const Settings = forwardRef<SettingsHandle, Props>(function Settings(
  { onDirtyChange, onSaved },
  ref
) {
  const { t, locale, setLocale } = useI18n();
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [initialCfg, setInitialCfg] = useState<AppConfig | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("general");
  const [modelSizeBytes, setModelSizeBytes] = useState<number | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<ModelDownloadStatus | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    getConfig().then((data) => {
      const supported = data.language === "ru" || data.language === "en";
      const normalized = supported ? data.language : getDefaultLanguage();
      const storedPrompt = localStorage.getItem(PROMPT_STORAGE_KEY) || "";
      const next = {
        ...data,
        language: normalized,
        summary_prompt: data.summary_prompt || storedPrompt || DEFAULT_SUMMARY_PROMPT,
      };
      setCfg(next);
      setInitialCfg(next);
    });
  }, []);

  useEffect(() => {
    if (!cfg) return;
    getModelSize(cfg.model_size)
      .then((bytes) => setModelSizeBytes(bytes))
      .catch(() => setModelSizeBytes(null));
    getModelDownloadStatus(cfg.model_size)
      .then(setDownloadStatus)
      .catch(() => setDownloadStatus(null));
  }, [cfg?.model_size]);

  useEffect(() => {
    if (!cfg || downloadStatus?.state !== "downloading") return;
    const timer = setInterval(() => {
      getModelDownloadStatus(cfg.model_size)
        .then(setDownloadStatus)
        .catch(() => {});
    }, 1000);
    return () => clearInterval(timer);
  }, [cfg?.model_size, downloadStatus?.state]);

  const dirty = useMemo(() => {
    if (!cfg || !initialCfg) return false;
    return JSON.stringify(cfg) !== JSON.stringify(initialCfg);
  }, [cfg, initialCfg]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => {
      setStatus(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [status]);

  const save = async () => {
    setStatus(null);
    if (!cfg) return;
    try {
      const updated = await updateConfig(cfg);
      const normalized = {
        ...updated,
        summary_prompt: updated.summary_prompt || cfg.summary_prompt || DEFAULT_SUMMARY_PROMPT,
      };
      if (normalized.summary_prompt) {
        localStorage.setItem(PROMPT_STORAGE_KEY, normalized.summary_prompt);
      }
      setCfg(normalized);
      setInitialCfg(normalized);
      setStatus(t("settings.status.saved"));
      onSaved?.(normalized);
    } catch {
      setStatus(t("settings.status.failed"));
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      save: () => {
        void save();
      },
      isDirty: () => dirty,
    }),
    [dirty]
  );

  if (!cfg) {
    return <div className="text-muted">{t("app.loading")}</div>;
  }

  const pickVault = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      setCfg({ ...cfg, vault_path: selected });
    }
  };

  const startDownload = async () => {
    setDownloadError(null);
    try {
      const next = await startModelDownload(cfg.model_size);
      setDownloadStatus(next);
    } catch {
      setDownloadError(t("settings.transcription.download_error"));
    }
  };

  const formatBytes = (bytes: number | null): string => {
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

  const downloadProgress = sizeBytes
    ? Math.round((downloadStatus?.downloaded_bytes ?? 0) / sizeBytes * 100)
    : 0;

  return (
    <div className="settings-page">
      <div className="settings-body">
        <div className="settings-tabs settings-tabs-row">
          <Tabs
            tabs={[
              { id: "general", label: t("settings.tabs.general") },
              { id: "transcription", label: t("settings.tabs.transcription") },
              { id: "summary", label: t("settings.tabs.summary") },
            ]}
            activeId={activeTab}
            onChange={setActiveTab}
          />
          {status && <div className="text-muted">{status}</div>}
        </div>

        {activeTab === "general" && (
          <>
            <Card>
              <div className="section-title">{t("settings.general.obsidian")}</div>
              <div className="form-row">
                <label>
                  {t("settings.general.vault_path")}
                  <div className="input-row">
                    <input
                      className="input"
                      value={cfg.vault_path}
                      onChange={(e) => setCfg({ ...cfg, vault_path: e.target.value })}
                    />
                    <Button variant="secondary" onClick={pickVault}>
                      {t("settings.general.browse")}
                    </Button>
                  </div>
                </label>
              </div>
              <div className="form-row">
                <label>
                  {t("settings.general.output_folder")}
                  <input
                    className="input"
                    value={cfg.output_subfolder}
                    onChange={(e) => setCfg({ ...cfg, output_subfolder: e.target.value })}
                  />
                </label>
              </div>
            </Card>

            <Card>
              <div className="section-title">{t("settings.general.ui_language")}</div>
              <div className="form-row">
                <label>
                  {t("settings.general.ui_language")}
                  <select
                    className="select"
                    value={locale}
                    onChange={(e) => setLocale(e.target.value as typeof locale)}
                  >
                    {SUPPORTED_LOCALES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="text-muted">
                {t("settings.general.ui_language_help")}
              </div>
            </Card>

          </>
        )}

        {activeTab === "transcription" && (
          <Card>
            <div className="section-title">{t("settings.tabs.transcription")}</div>
            <div className="form-row">
              <label>
                {t("settings.transcription.model")}
                <select
                  className="select"
                  value={cfg.model_size}
                  onChange={(e) =>
                    setCfg({
                      ...cfg,
                      model_size: e.target.value as
                        | "tiny"
                        | "small"
                        | "medium"
                        | "large-v3",
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
            <div className="form-row">
              <label>
                {t("settings.transcription.language")}
                <select
                  className="select"
                  value={cfg.language ?? "ru"}
                  onChange={(e) => setCfg({ ...cfg, language: e.target.value })}
                >
                  <option value="ru">{t("language.ru")}</option>
                  <option value="en">{t("language.en")}</option>
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                <input
                  type="checkbox"
                  checked={cfg.include_timestamps}
                  onChange={(e) => setCfg({ ...cfg, include_timestamps: e.target.checked })}
                />{" "}
                {t("settings.transcription.timestamps")}
              </label>
            </div>
            <details className="form-row">
              <summary className="text-muted">{t("settings.advanced")}</summary>
              <label>
                <input
                  type="checkbox"
                  checked={cfg.preload_model ?? false}
                  onChange={(e) => setCfg({ ...cfg, preload_model: e.target.checked })}
                />{" "}
                {t("settings.transcription.preload")}
              </label>
            </details>
            <div className="panel" style={{ marginTop: 12 }}>
              <div className="section-title">{t("settings.transcription.download")}</div>
              <div className="text-muted" style={{ marginBottom: 8 }}>
                {t("settings.transcription.size")}: {formatBytes(sizeBytes)}
              </div>
              {downloadStatus?.state === "downloading" && sizeBytes ? (
                <div style={{ marginBottom: 8 }}>
                  <ProgressBar value={downloadProgress} />
                  <div className="text-muted" style={{ marginTop: 6 }}>
                    {formatBytes(downloadStatus.downloaded_bytes)} / {formatBytes(sizeBytes)}
                  </div>
                </div>
              ) : null}
              {downloadStatus?.state === "done" && (
                <div className="text-muted">{t("settings.transcription.download_done")}</div>
              )}
              {downloadStatus?.state === "error" && (
                <div className="text-muted">
                  {t("settings.transcription.download_error")}: {downloadStatus.message || "—"}
                </div>
              )}
              {downloadError && <div className="text-muted">{downloadError}</div>}
              {downloadStatus?.state !== "done" && (
                <Button
                  variant="secondary"
                  onClick={startDownload}
                  disabled={downloadStatus?.state === "downloading"}
                >
                  {t("settings.transcription.download_button")}
                </Button>
              )}
            </div>
          </Card>
        )}

        {activeTab === "summary" && (
          <Card>
            <div className="section-title">{t("settings.tabs.summary")}</div>
            <div className="form-row">
              <label>
                <input
                  type="checkbox"
                  checked={cfg.enable_summarization ?? true}
                  onChange={(e) => setCfg({ ...cfg, enable_summarization: e.target.checked })}
                />{" "}
                {t("settings.summary.enable")}
              </label>
            </div>
            <div className="form-row">
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
                {t("settings.summary.auto")}
              </label>
            </div>
            <div className="form-row">
              <label>
                {t("settings.summary.model")}
                <input
                  className="input"
                  value={cfg.ollama_model ?? "qwen2.5:7b-instruct"}
                  onChange={(e) => setCfg({ ...cfg, ollama_model: e.target.value })}
                />
              </label>
            </div>
            <details className="form-row">
              <summary className="text-muted">{t("settings.advanced")}</summary>
              <label>
                {t("settings.summary.base_url")}
                <input
                  className="input"
                  value={cfg.ollama_base_url ?? "http://127.0.0.1:11434"}
                  onChange={(e) => setCfg({ ...cfg, ollama_base_url: e.target.value })}
                />
              </label>
            </details>
            <div className="form-row">
              <label>
                {t("settings.summary.prompt")}
                <textarea
                  className="textarea"
                  rows={10}
                  value={cfg.summary_prompt}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCfg({ ...cfg, summary_prompt: value });
                    localStorage.setItem(PROMPT_STORAGE_KEY, value);
                  }}
                />
              </label>
              <div className="text-muted">
                {t("settings.summary.prompt_help")}
              </div>
            </div>
          </Card>
        )}
      </div>

    </div>
  );
});

export default Settings;
