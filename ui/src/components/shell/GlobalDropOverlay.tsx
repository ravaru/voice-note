import React, { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";

type Props = {
  onFiles: (files: FileList) => void;
  children: React.ReactNode;
};

export default function GlobalDropOverlay({ onFiles, children }: Props) {
  const { t } = useI18n();
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    // Window-level handlers make drag/drop work on any screen.
    const handleDragEnter = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!event.dataTransfer) return;
      if (Array.from(event.dataTransfer.types).includes("Files")) {
        dragCounter.current += 1;
        setIsDragging(true);
      }
    };

    const handleDragLeave = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragCounter.current = Math.max(0, dragCounter.current - 1);
      if (dragCounter.current === 0) {
        setIsDragging(false);
      }
    };

    const handleDragOver = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
    };

    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);
      if (event.dataTransfer?.files?.length) {
        onFiles(event.dataTransfer.files);
      }
    };

    window.addEventListener("dragenter", handleDragEnter, true);
    window.addEventListener("dragleave", handleDragLeave, true);
    window.addEventListener("dragover", handleDragOver, true);
    window.addEventListener("drop", handleDrop, true);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter, true);
      window.removeEventListener("dragleave", handleDragLeave, true);
      window.removeEventListener("dragover", handleDragOver, true);
      window.removeEventListener("drop", handleDrop, true);
    };
  }, [onFiles]);

  return (
    <div className="global-drop-root">
      {children}
      {isDragging && (
        <div className="drop-overlay" role="presentation">
          {t("jobs.empty")}
        </div>
      )}
    </div>
  );
}
