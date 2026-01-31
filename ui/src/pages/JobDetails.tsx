import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Job } from "../api/types";
import Button from "../components/ui/Button";
import Pill from "../components/ui/Pill";
import ProgressBar from "../components/ui/ProgressBar";
import Tabs from "../components/tabs/Tabs";
import TranscriptPanel from "../components/jobs/TranscriptPanel";
import SummaryPanel from "../components/jobs/SummaryPanel";
import ConsolePanel from "../components/console/ConsolePanel";
import { getJobStatusLabel, getJobStatusTone } from "../components/jobs/statusLabels";
import { useI18n } from "../i18n/I18nProvider";

type Props = {
  job: Job | null;
  jobId: string;
  vaultConfigured: boolean;
  onExport: (job: Job) => Promise<void>;
  onCancel: (job: Job) => void;
  onOpenSettings: () => void;
  onClose: () => void;
};

function humanizeFilename(name: string): string {
  const withoutExt = name.replace(/\.[^/.]+$/, "");
  return withoutExt.replace(/_/g, " ");
}

export default function JobDetails({
  job,
  jobId,
  vaultConfigured,
  onExport,
  onCancel,
  onOpenSettings,
  onClose,
}: Props) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("transcript");
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const title = useMemo(() => (job ? humanizeFilename(job.filename) : ""), [job]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (event.target instanceof Node && menuRef.current.contains(event.target)) return;
      setMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    // Esc returns to the jobs list (native back behavior for details view).
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!job) {
    return <div className="text-muted">{t("details.loading")}</div>;
  }

  return (
    <div className="details-page">
      <div className="details-header">
        <Button
          variant="ghost"
          onClick={onClose}
          className="back-button"
          aria-label={`${t("sidebar.jobs")}`}
        >
          ← {t("sidebar.jobs")}
        </Button>
        <div>
          <div className="list-row-title">{title}</div>
          <div className="details-meta">
            {job.status === "running" && (
              <div style={{ minWidth: 160 }}>
                <ProgressBar value={job.progress} />
              </div>
            )}
          </div>
        </div>
        <div className="row-actions">
          {job.status === "done" && (
            <Button
              variant="primary"
              onClick={async () => {
                setExportStatus(null);
                if (!vaultConfigured) {
                  setExportStatus(t("details.export_missing"));
                  return;
                }
                try {
                  await onExport(job);
                  setExportStatus(t("details.export_saved"));
                } catch (err) {
                  const message = err instanceof Error ? err.message : t("details.export_failed");
                  setExportStatus(message);
                }
              }}
            >
              {t("details.export")}
            </Button>
          )}
          {job.status === "running" && (
            <div className="menu" ref={menuRef}>
              <Button
                variant="ghost"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={t("jobs.actions.menu")}
              >
                ⋯
              </Button>
              {menuOpen && (
                <div className="menu-panel" role="menu">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onCancel(job);
                    }}
                  >
                    {t("jobs.actions.cancel")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {exportStatus && (
        <div className="text-muted" style={{ marginBottom: 12 }}>
          {exportStatus}
          {!vaultConfigured && (
            <Button
              variant="ghost"
              onClick={onOpenSettings}
              style={{ marginLeft: 8 }}
            >
              {t("details.open_settings")}
            </Button>
          )}
        </div>
      )}

      <div className="tabs-row details-tabs">
        <Tabs
          tabs={[
            { id: "transcript", label: t("details.tabs.transcript") },
            { id: "summary", label: t("details.tabs.summary") },
            { id: "console", label: t("details.tabs.console") },
          ]}
          activeId={activeTab}
          onChange={setActiveTab}
        />
        <div className="tabs-status">
          <Pill tone={getJobStatusTone(job)}>{getJobStatusLabel(job, t)}</Pill>
        </div>
      </div>

      <div className="details-tab-body">
        {activeTab === "transcript" && (
          <TranscriptPanel jobId={jobId} jobStatus={job.status} />
        )}
        {activeTab === "summary" && <SummaryPanel jobId={jobId} />}
        {activeTab === "console" && <ConsolePanel job={job} logs={job.logs || []} />}
      </div>
    </div>
  );
}
