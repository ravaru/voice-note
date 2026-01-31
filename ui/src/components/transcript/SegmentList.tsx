import React from "react";
import type { Segment } from "../../api/types";

function formatHHMMSS(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")}`;
}

type Props = {
  segments: Segment[];
  activeIndex: number | null;
  onSelect: (segment: Segment, index: number) => void;
  indices?: number[];
};

export default function SegmentList({ segments, activeIndex, onSelect, indices }: Props) {
  return (
    <div className="segment-list" role="list">
      {segments.map((seg, idx) => {
        const sourceIndex = indices?.[idx] ?? idx;
        return (
        <button
            key={`${seg.start}-${seg.end}-${sourceIndex}`}
            type="button"
            className={`segment-item ${activeIndex === sourceIndex ? "active" : ""}`}
            onClick={() => onSelect(seg, sourceIndex)}
          >
            <div className="segment-time">
              <span className="segment-play" aria-hidden="true">▶</span>
              <span className="table-muted">{formatHHMMSS(seg.start)}</span>
            </div>
            <div>{seg.text}</div>
          </button>
        );
      })}
    </div>
  );
}
