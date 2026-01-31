import React, { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { initializeConfig } from "../api/client";
import type { AppConfig } from "../api/types";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { useI18n } from "../i18n/I18nProvider";

const STEPS = 3;

type Props = {
  onFinished: () => void;
};

const getDefaultLanguage = (): "ru" | "en" => {
  const system = navigator.language?.toLowerCase() ?? "en";
  return system.startsWith("ru") ? "ru" : "en";
};

export default function Wizard({ onFinished }: Props) {
  const { t } = useI18n();
  const [vaultPath, setVaultPath] = useState("");
  const [outputSubfolder, setOutputSubfolder] = useState("Transcripts");
  const [modelSize, setModelSize] = useState<
    "tiny" | "small" | "medium" | "large-v3"
  >("tiny");
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [language] = useState<"ru" | "en">(getDefaultLanguage());
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
        language,
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
      const message = e instanceof Error ? e.message : t("wizard.error");
      setError(message);
    }
  };

  return (
    <Card style={{ width: "min(720px, 100%)" }}>
      <div className="section-title">{t("wizard.title")}</div>
      <div className="stepper">
        {Array.from({ length: STEPS }, (_, idx) => (
          <div key={idx} className={`step ${idx < step ? "active" : ""}`} />
        ))}
      </div>

      {step === 1 && (
        <div>
          <div className="section-title">{t("wizard.step1")}</div>
          <div className="form-row">
            <Button variant="secondary" onClick={handlePickVault}>
              {t("wizard.choose_folder")}
            </Button>
            <div className="text-muted">
              {t("wizard.selected")}: {vaultPath || t("common.none")}
            </div>
          </div>
          <div className="row-actions">
            <Button variant="primary" disabled={!vaultPath} onClick={() => setStep(2)}>
              {t("wizard.next")}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="section-title">{t("wizard.step2")}</div>
          <div className="form-row">
            <input
              className="input"
              value={outputSubfolder}
              onChange={(e) => setOutputSubfolder(e.target.value)}
              placeholder="Transcripts"
            />
          </div>
          <div className="row-actions">
            <Button variant="ghost" onClick={() => setStep(1)}>
              {t("wizard.back")}
            </Button>
            <Button variant="primary" onClick={() => setStep(3)}>
              {t("wizard.next")}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="section-title">{t("wizard.step3")}</div>
          <div className="form-row">
            <label>
              {t("settings.transcription.model")}
              <select
                className="select"
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
          <div className="form-row">
            <label>
              <input
                type="checkbox"
                checked={includeTimestamps}
                onChange={(e) => setIncludeTimestamps(e.target.checked)}
              />{" "}
              {t("wizard.timestamps")}
            </label>
          </div>
          <div className="row-actions">
            <Button variant="ghost" onClick={() => setStep(2)}>
              {t("wizard.back")}
            </Button>
            <Button variant="primary" onClick={finish}>
              {t("wizard.done")}
            </Button>
          </div>
        </div>
      )}

      {error && <div className="text-muted" style={{ marginTop: 12 }}>{error}</div>}
    </Card>
  );
}
