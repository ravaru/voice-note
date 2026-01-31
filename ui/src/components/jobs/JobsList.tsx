import React from "react";
import type { Job } from "../../api/types";
import JobRow from "./JobRow";
import { useI18n } from "../../i18n/I18nProvider";

type Props = {
  jobs: Job[];
  modelSize?: string;
  language?: string;
  showEmpty?: boolean;
  onOpen: (job: Job) => void;
  onExport: (job: Job) => void;
  onCancel: (job: Job) => void;
  onDelete: (job: Job) => void;
};

export default function JobsList({
  jobs,
  modelSize,
  language,
  showEmpty = true,
  onOpen,
  onExport,
  onCancel,
  onDelete,
}: Props) {
  const { t } = useI18n();
  if (jobs.length === 0 && showEmpty) {
    return (
      <div className="empty-state">
        {t("jobs.empty")}
      </div>
    );
  }
  if (jobs.length === 0) {
    return null;
  }

  return (
    <div className="list" role="list">
      {jobs.map((job) => (
        <JobRow
          key={job.id}
          job={job}
          modelSize={modelSize}
          language={language}
          onOpen={onOpen}
          onExport={onExport}
          onCancel={onCancel}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
