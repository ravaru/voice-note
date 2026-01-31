import React, { useCallback, useRef, useState } from "react";
import type { Job } from "../api/types";
import JobsList from "../components/jobs/JobsList";
import Button from "../components/ui/Button";
import { useI18n } from "../i18n/I18nProvider";

type Props = {
  jobs: Job[];
  modelSize?: string;
  language?: string;
  onAddAudio: () => void;
  onFiles: (files: FileList) => void;
  onOpen: (job: Job) => void;
  onExport: (job: Job) => void;
  onCancel: (job: Job) => void;
  onDelete: (job: Job) => void;
};

export default function Jobs({
  jobs,
  modelSize,
  language,
  onAddAudio,
  onFiles,
  onOpen,
  onExport,
  onCancel,
  onDelete,
}: Props) {
  const { t } = useI18n();
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragEnter = useCallback((event: React.DragEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (event.dataTransfer.types.includes("Files")) {
      dragCounter.current += 1;
      setIsDragging(true);
    }
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent) => {
    event.stopPropagation();
    event.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.stopPropagation();
      event.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      if (event.dataTransfer.files.length > 0) {
        onFiles(event.dataTransfer.files);
      }
    },
    [onFiles]
  );

  return (
    <div className="jobs-page">
      <div
        className={`jobs-dropzone ${isDragging ? "is-dragging" : ""}`}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        role="presentation"
      >
        <div className="jobs-dropzone-text">
          {t("jobs.empty")}
        </div>
        <div className="jobs-dropzone-actions">
          <Button variant="primary" onClick={onAddAudio}>
            {t("toolbar.add_audio")}
          </Button>
        </div>
      </div>

      <JobsList
        jobs={jobs}
        modelSize={modelSize}
        language={language}
        showEmpty={false}
        onOpen={onOpen}
        onExport={onExport}
        onCancel={onCancel}
        onDelete={onDelete}
      />
    </div>
  );
}
