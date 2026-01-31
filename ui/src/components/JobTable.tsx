import React from "react";
import type { Job, JobStatus } from "../api/types";
import { open } from "@tauri-apps/plugin-shell";
import { useI18n } from "../i18n/I18nProvider";

type Props = {
  jobs: Job[];
  onView: (job: Job) => void;
  onExport: (job: Job) => void;
  onCancel: (job: Job) => void;
};

const STATUS_LABELS: Record<JobStatus, string> = {
  queued: "jobs.status.queued",
  running: "jobs.status.processing",
  done: "jobs.status.done",
  error: "jobs.status.error",
  cancelled: "jobs.status.cancelled",
};

export default function JobTable({ jobs, onView, onExport, onCancel }: Props) {
  const { t } = useI18n();
  return (
    <table style={{ width: "100%", marginTop: 16, borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left" }}>{t("jobs.file")}</th>
          <th>{t("jobs.status")}</th>
          <th>{t("jobs.progress")}</th>
          <th>{t("jobs.actions")}</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <tr key={job.id} style={{ borderTop: "1px solid #ddd" }}>
            <td>{job.filename}</td>
            <td>{t(STATUS_LABELS[job.status] ?? job.status)}</td>
            <td>{job.progress}%</td>
            <td>
              <button onClick={() => onView(job)}>{t("jobs.actions.open")}</button>
              <button onClick={() => onExport(job)} style={{ marginLeft: 8 }}>
                {t("details.export")}
              </button>
              <button
                onClick={() => {
                  // Open job output folder using Tauri shell plugin.
                  // In non-Tauri (browser) environments this may throw, so we guard it.
                  try {
                    const parts = job.audio_path.split("/");
                    parts.pop();
                    const folder = parts.join("/");
                    open(folder);
                  } catch {
                    // Ignore if not running inside Tauri.
                  }
                }}
                style={{ marginLeft: 8 }}
              >
                {t("jobs.actions.open_folder")}
              </button>
              <button onClick={() => onCancel(job)} style={{ marginLeft: 8 }}>
                {t("jobs.actions.cancel")}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
