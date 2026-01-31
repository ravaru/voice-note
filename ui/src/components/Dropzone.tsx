import React, { useCallback, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";

type Props = {
  onFiles: (files: FileList) => void;
};

// Minimal dropzone that accepts mp3 files.
export default function Dropzone({ onFiles }: Props) {
  const { t } = useI18n();
  const [isDragging, setIsDragging] = useState(false);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        onFiles(e.dataTransfer.files);
      }
    },
    [onFiles]
  );

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        border: "2px dashed #888",
        padding: 24,
        borderRadius: 8,
        background: isDragging ? "#f4f4f4" : "transparent",
      }}
    >
      <p>{t("dropzone.hint")}</p>
      <input
        type="file"
        accept="audio/mpeg,audio/mp4,audio/wav,.mp3,.m4a,.wav"
        multiple
        onChange={(e) => {
          if (e.target.files) onFiles(e.target.files);
        }}
      />
    </div>
  );
}
