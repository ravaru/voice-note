import React, { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";

type Props = {
  onFiles: (files: FileList) => void;
  children: React.ReactNode;
};

export default function DropOverlay({ onFiles, children }: Props) {
  const { t } = useI18n();
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    const handleDragEnter = (event: DragEvent) => {
      if (!event.dataTransfer) return;
      if (Array.from(event.dataTransfer.types).includes("Files")) {
        dragCounter.current += 1;
        setIsDragging(true);
      }
    };

    const handleDragLeave = () => {
      dragCounter.current = Math.max(0, dragCounter.current - 1);
      if (dragCounter.current === 0) {
        setIsDragging(false);
      }
    };

    const handleDragOver = (event: DragEvent) => {
      event.preventDefault();
    };

    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      if (event.dataTransfer?.files?.length) {
        onFiles(event.dataTransfer.files);
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [onFiles]);

  return (
    <div className="jobs-page">
      {children}
      {isDragging && (
        <div className="drop-overlay">{t("jobs.empty")}</div>
      )}
    </div>
  );
}
