import type { Job } from "../../api/types";

export function getJobStatusLabel(job: Job, t: (key: string) => string): string {
  if (job.status === "running") {
    if (job.summary_status === "running") return t("jobs.status.summarize");
    switch (job.stage) {
      case "transcribe":
        return t("jobs.status.transcribe");
      case "convert":
      case "vad":
      case "merge":
      case "export":
        return t("jobs.status.processing");
      default:
        return t("jobs.status.processing");
    }
  }

  if (job.status === "queued") return t("jobs.status.queued");
  if (job.status === "done") return t("jobs.status.done");
  if (job.status === "error") return t("jobs.status.error");
  if (job.status === "cancelled") return t("jobs.status.cancelled");

  return job.status;
}

export function getJobStatusTone(job: Job): "neutral" | "success" | "warning" | "error" | "info" {
  if (job.status === "done") return "success";
  if (job.status === "error") return "error";
  if (job.status === "running") return "warning";
  if (job.status === "queued") return "info";
  if (job.status === "cancelled") return "neutral";
  return "neutral";
}
