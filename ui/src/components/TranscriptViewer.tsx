import React, { useEffect, useMemo, useState } from "react";
import { getSegments, getClipUrl } from "../api/client";
import type { Segment } from "../api/types";

function formatHHMMSS(seconds: number): string {
  // Simple HH:MM:SS formatter; we keep it in UI to avoid extra endpoint.
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

type Props = {
  jobId: string;
};

export default function TranscriptViewer({ jobId }: Props) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSegments(jobId)
      .then((data) => {
        if (!cancelled) setSegments(data);
      })
      .catch(() => {
        if (!cancelled) setSegments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const fullText = useMemo(() => {
    return segments.map((s) => s.text).join(" ");
  }, [segments]);

  return (
    <div style={{ marginTop: 16 }}>
      <h3>Расшифровка</h3>

      <div style={{ marginBottom: 12 }}>
        {audioSrc ? (
          <audio controls src={audioSrc} />
        ) : (
          <div>Нажмите на сегмент, чтобы воспроизвести его аудиоклип.</div>
        )}
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          padding: 12,
          maxHeight: 220,
          overflow: "auto",
          background: "#fff",
        }}
      >
        {segments.length === 0 && <div>Сегментов пока нет.</div>}
        {segments.map((seg, idx) => (
          <div
            key={idx}
            style={{ cursor: "pointer", marginBottom: 6 }}
            onClick={() => {
              // Each click produces a new clip URL.
              const url = getClipUrl(jobId, seg.start, seg.end);
              setAudioSrc(url);
            }}
          >
            <strong>{formatHHMMSS(seg.start)}</strong> — {seg.text}
          </div>
        ))}
      </div>

      <h4 style={{ marginTop: 16 }}>Полный текст</h4>
      <div style={{ whiteSpace: "pre-wrap", background: "#fafafa", padding: 12 }}>
        {fullText || "(пусто)"}
      </div>
    </div>
  );
}
