import React from "react";
import type { Job, JobStatus } from "../api/types";
import { open } from "@tauri-apps/plugin-shell";

type Props = {
  jobs: Job[];
  onView: (job: Job) => void;
  onExport: (job: Job) => void;
  onCancel: (job: Job) => void;
};

const STATUS_LABELS: Record<JobStatus, string> = {
  queued: "в очереди",
  running: "в работе",
  done: "готово",
  error: "ошибка",
  cancelled: "отменено",
};

export default function JobTable({ jobs, onView, onExport, onCancel }: Props) {
  return (
    <table style={{ width: "100%", marginTop: 16, borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left" }}>Файл</th>
          <th>Статус</th>
          <th>Прогресс</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <tr key={job.id} style={{ borderTop: "1px solid #ddd" }}>
            <td>{job.filename}</td>
            <td>{STATUS_LABELS[job.status] ?? job.status}</td>
            <td>{job.progress}%</td>
            <td>
              <button onClick={() => onView(job)}>Просмотр</button>
              <button onClick={() => onExport(job)} style={{ marginLeft: 8 }}>
                Экспорт в Obsidian
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
                Открыть папку вывода
              </button>
              <button onClick={() => onCancel(job)} style={{ marginLeft: 8 }}>
                Отменить
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
