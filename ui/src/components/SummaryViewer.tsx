import React, { useEffect, useState } from "react";
import { getSummary, summarizeJob } from "../api/client";
import MarkdownPreview from "./MarkdownPreview";
import type { SummaryResponse } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";

type Props = {
  jobId: string;
};

export default function SummaryViewer({ jobId }: Props) {
  const { t } = useI18n();
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    // Load summary on-demand to avoid bloating the main job payload.
    try {
      const data = await getSummary(jobId);
      setSummary(data);
      setError(null);
    } catch {
      setSummary(null);
      setError(t("summary.load_error"));
    }
  };

  useEffect(() => {
    load();
  }, [jobId]);

  const regenerate = async () => {
    // Manual regeneration calls backend summarization endpoint.
    setStatus(null);
    setError(null);
    try {
      const data = await summarizeJob(jobId);
      setSummary(data);
      setStatus(t("summary.updated"));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("summary.load_error");
      setError(message);
      setStatus(t("summary.load_error"));
      try {
        const data = await getSummary(jobId);
        setSummary(data);
      } catch {
        // Ignore secondary failure.
      }
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <h3>{t("summary.title")}</h3>
      {summary && (
        <div
          style={{
            height: 6,
            borderRadius: 6,
            background: "#eee",
            overflow: "hidden",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              height: "100%",
              width:
                summary.summary_status === "done"
                  ? "100%"
                  : summary.summary_status === "running"
                    ? "60%"
                    : summary.summary_status === "error"
                      ? "100%"
                      : "20%",
              background:
                summary.summary_status === "done"
                  ? "#2ecc71"
                  : summary.summary_status === "running"
                    ? "#f1c40f"
                    : summary.summary_status === "error"
                      ? "#e74c3c"
                      : "#bbb",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      )}
      {summary ? (
        <>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
            {t("summary.status_label")}: {summary.summary_status} · {t("settings.summary.model")}: {summary.summary_model}
          </div>
          {summary.summary_error && (
            <div style={{ color: "red", fontSize: 12, marginBottom: 8 }}>
              {t("summary.error_label")}: {summary.summary_error}
            </div>
          )}
          {summary.summary_status === "not_started" && !summary.summary_md && (
            <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
              {t("summary.not_ready")}
            </div>
          )}
          <MarkdownPreview markdown={summary.summary_md || "—"} />
        </>
      ) : (
        <div>{t("summary.unavailable")}</div>
      )}
      {error && (
        <div style={{ color: "red", fontSize: 12, marginTop: 8 }}>{error}</div>
      )}
      <button onClick={regenerate} style={{ marginTop: 8 }}>
        {t("summary.regenerate_inline")}
      </button>
      {status && <div style={{ marginTop: 8 }}>{status}</div>}
    </div>
  );
}
