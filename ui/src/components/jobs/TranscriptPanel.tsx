import React, { useEffect, useMemo, useState } from "react";
import { getSegments, getClipUrl } from "../../api/client";
import type { Job, Segment } from "../../api/types";
import SegmentList from "../transcript/SegmentList";
import ClipPlayer from "../player/ClipPlayer";
import { useI18n } from "../../i18n/I18nProvider";

type Props = {
  jobId: string;
  jobStatus: Job["status"];
};

export default function TranscriptPanel({ jobId, jobStatus }: Props) {
  const { t } = useI18n();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [query, setQuery] = useState("");

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

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedQuery) {
      return {
        segments,
        indices: segments.map((_, idx) => idx),
      };
    }
    return segments.reduce(
      (acc, seg, idx) => {
        if (seg.text.toLowerCase().includes(normalizedQuery)) {
          acc.segments.push(seg);
          acc.indices.push(idx);
        }
        return acc;
      },
      { segments: [] as Segment[], indices: [] as number[] },
    );
  }, [normalizedQuery, segments]);

  if (segments.length === 0) {
    return (
      <div className="panel transcript-panel">
        <div className="text-muted">
          {jobStatus === "running" || jobStatus === "queued"
            ? t("transcript.empty.running")
            : t("transcript.empty.none")}
        </div>
      </div>
    );
  }

  return (
    <div className="panel transcript-panel details-scroll-panel">
      <div className="form-row" style={{ marginBottom: 16 }}>
        <label>
          <span className="text-muted">{t("transcript.search")}</span>
          <input
            className="input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("transcript.search_placeholder")}
            aria-label={t("transcript.search")}
          />
        </label>
      </div>

      {filtered.segments.length > 0 ? (
        <SegmentList
          segments={filtered.segments}
          indices={filtered.indices}
          activeIndex={activeIndex}
          onSelect={(seg, idx) => {
            const url = getClipUrl(jobId, seg.start, seg.end);
            setAudioSrc(url);
            setActiveIndex(idx);
          }}
        />
      ) : (
        <div className="text-muted">{t("transcript.search_empty")}</div>
      )}

      <ClipPlayer
        src={audioSrc}
        onEnded={() => {
          setActiveIndex(null);
        }}
      />
    </div>
  );
}
