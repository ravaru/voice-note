import React, { memo, useMemo } from "react";
import type { Job } from "../../api/types";
import Button from "../ui/Button";
import ProgressBar from "../ui/ProgressBar";
import Pill from "../ui/Pill";
import { getJobStatusLabel, getJobStatusTone } from "./statusLabels";
import { useI18n } from "../../i18n/I18nProvider";

type Props = {
  job: Job;
  modelSize?: string;
  language?: string;
  onOpen: (job: Job) => void;
  onExport: (job: Job) => void;
  onCancel: (job: Job) => void;
  onDelete: (job: Job) => void;
};

function JobRow({ job, modelSize, language, onOpen, onExport, onCancel, onDelete }: Props) {
  const { t } = useI18n();
  const summaryMark =
    job.summary_status === "done" ? t("jobs.summary_done") : t("jobs.summary_none");

  const modelLabel = useMemo(() => {
    if (job.status === "running") {
      if (job.summary_status === "running") {
        const lang = language ? language.toUpperCase() : "—";
        return `${t("settings.summary.model")} ${job.summary_model || "—"} · ${lang}`;
      }
      return `${t("settings.transcription.model")} ${modelSize || "—"}`;
    }
    return job.summary_model ? `${t("settings.summary.model")} ${job.summary_model}` : null;
  }, [job.status, job.summary_status, job.summary_model, modelSize, language, t]);

  const subtitleParts = [modelLabel, summaryMark].filter(Boolean);

  return (
    <div className="list-row" aria-label={`${t("jobs.item")} ${job.filename}`}>
      <div>
        <div className="list-row-header">
          <div className="list-row-title" title={job.filename}>
            {job.filename}
          </div>
          <Pill tone={getJobStatusTone(job)}>{getJobStatusLabel(job, t)}</Pill>
        </div>
        <div className="list-row-subtitle">{subtitleParts.join(" · ")}</div>
        {job.status === "running" && (
          <div style={{ marginTop: 8 }}>
            <ProgressBar value={job.progress} />
          </div>
        )}
      </div>
      <div className="row-actions">
        {(job.status === "running" || job.status === "done") && (
          <Button variant="primary" onClick={() => onOpen(job)}>
            {t("jobs.actions.open")}
          </Button>
        )}
        {job.status === "done" && (
          <Button variant="secondary" onClick={() => onExport(job)}>
            {t("jobs.actions.export")}
          </Button>
        )}
        {job.status === "running" ? (
          <Button
            variant="ghost"
            onClick={() => onCancel(job)}
            aria-label={t("jobs.actions.cancel")}
            className="icon-btn"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M7.5 16.5L16.5 7.5" stroke="currentColor" strokeWidth="2" />
            </svg>
          </Button>
        ) : (
          <Button
            variant="ghost"
            onClick={() => onDelete(job)}
            aria-label={t("jobs.actions.delete")}
            className="icon-btn"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M9 4h6l1 2h4v2H4V6h4l1-2zm1 6h2v8h-2v-8zm4 0h2v8h-2v-8zM7 10h2v8H7v-8z"
                fill="currentColor"
              />
              <rect x="6" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </Button>
        )}
      </div>
    </div>
  );
}

export default memo(JobRow);
