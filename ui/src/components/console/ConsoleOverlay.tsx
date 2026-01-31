import React, { useEffect, useMemo } from "react";
import type { Job } from "../../api/types";
import Button from "../ui/Button";
import Pill from "../ui/Pill";
import useAutoScroll from "./useAutoScroll";
import { useI18n } from "../../i18n/I18nProvider";

const STATUS_LABELS: Record<Job["status"], string> = {
  queued: "jobs.status.queued",
  running: "jobs.status.processing",
  done: "jobs.status.done",
  error: "jobs.status.error",
  cancelled: "jobs.status.cancelled",
};

const STATUS_TONE: Record<Job["status"], "neutral" | "success" | "warning" | "error"> = {
  queued: "neutral",
  running: "warning",
  done: "success",
  error: "error",
  cancelled: "neutral",
};

type Props = {
  open: boolean;
  job: Job;
  logs: string[];
  onClose: () => void;
};

export default function ConsoleOverlay({ open, job, logs, onClose }: Props) {
  const { t } = useI18n();
  const trimmedLogs = useMemo(() => logs.slice(-2000), [logs]);
  const { containerRef, follow, setFollow, handleScroll, scrollToBottom } = useAutoScroll(
    trimmedLogs.length
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="console-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="console-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="console-header">
          <div>
            <div className="console-title">{t("console.title")}</div>
            <div className="console-subtitle">{job.filename}</div>
          </div>
          <div className="console-actions">
            <Pill tone={STATUS_TONE[job.status]}>{t(STATUS_LABELS[job.status])}</Pill>
            <Button variant="secondary" onClick={onClose} aria-label={t("toolbar.close")}>
              ✕
            </Button>
          </div>
        </div>

        <div className="console-body" ref={containerRef} onScroll={handleScroll}>
          {trimmedLogs.length === 0 ? (
            <div className="console-empty">{t("console.empty")}</div>
          ) : (
            trimmedLogs.map((line, idx) => (
              <div key={`${idx}-${line}`} className="console-line">
                {line}
              </div>
            ))
          )}
        </div>

        <div className="console-footer">
          {!follow && (
            <Button
              variant="secondary"
              onClick={() => {
                setFollow(true);
                scrollToBottom();
              }}
            >
              {t("console.follow")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
