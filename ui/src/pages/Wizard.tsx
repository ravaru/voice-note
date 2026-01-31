import React, { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { initializeConfig } from "../api/client";
import type { AppConfig } from "../api/types";

type Props = {
  onFinished: () => void;
};

export default function Wizard({ onFinished }: Props) {
  const [vaultPath, setVaultPath] = useState("");
  const [outputSubfolder, setOutputSubfolder] = useState("Transcripts");
  const [modelSize, setModelSize] = useState<
    "tiny" | "small" | "medium" | "large-v3"
  >("tiny");
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const handlePickVault = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      setVaultPath(selected);
    }
  };

  const finish = async () => {
    setError(null);
    try {
      const cfg: AppConfig = {
        initialized: true,
        vault_path: vaultPath,
        output_subfolder: outputSubfolder || "Transcripts",
        model_size: modelSize,
        language: "ru",
        // Summarization defaults are set here so first run behaves predictably.
        enable_summarization: true,
        auto_summarize_after_transcription: true,
        ollama_base_url: "http://127.0.0.1:11434",
        ollama_model: "qwen2.5:7b-instruct",
        include_timestamps: includeTimestamps,
        watch_inbox_enabled: false,
        inbox_poll_seconds: 8,
      };
      await initializeConfig(cfg);
      onFinished();
    } catch (e) {
      setError("Не удалось сохранить настройки");
    }
  };

  return (
    <div>
      <h2>Добро пожаловать в VoiceNote</h2>

      {step === 1 && (
        <div>
          <h3>Шаг 1: Выберите папку хранилища Obsidian</h3>
          <button onClick={handlePickVault}>Выбрать папку</button>
          <div style={{ marginTop: 8 }}>Выбрано: {vaultPath || "(нет)"}</div>
          <div style={{ marginTop: 16 }}>
            <button disabled={!vaultPath} onClick={() => setStep(2)}>
              Далее
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3>Шаг 2: Подпапка вывода</h3>
          <input
            value={outputSubfolder}
            onChange={(e) => setOutputSubfolder(e.target.value)}
            placeholder="Transcripts"
          />
          <div style={{ marginTop: 16 }}>
            <button onClick={() => setStep(1)}>Назад</button>
            <button onClick={() => setStep(3)} style={{ marginLeft: 8 }}>
              Далее
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h3>Шаг 3: Модель и метки времени</h3>
          <div>
            <label>
              Модель:
              <select
                value={modelSize}
                onChange={(e) =>
                  setModelSize(
                    e.target.value as "tiny" | "small" | "medium" | "large-v3"
                  )
                }
              >
                <option value="tiny">tiny</option>
                <option value="small">small</option>
                <option value="medium">medium</option>
                <option value="large-v3">large-v3</option>
              </select>
            </label>
          </div>
          <div style={{ marginTop: 8 }}>
            <label>
              <input
                type="checkbox"
                checked={includeTimestamps}
                onChange={(e) => setIncludeTimestamps(e.target.checked)}
              />{" "}
              Показывать метки времени в интерфейсе
            </label>
          </div>
          <div style={{ marginTop: 16 }}>
            <button onClick={() => setStep(2)}>Назад</button>
            <button onClick={finish} style={{ marginLeft: 8 }}>
              Готово
            </button>
          </div>
        </div>
      )}

      {error && <div style={{ color: "red" }}>{error}</div>}
    </div>
  );
}
