import React from "react";

type Props = {
  value: number;
};

export default function ProgressBar({ value }: Props) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className="progress" role="progressbar" aria-valuenow={safe} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${safe}%` }} />
    </div>
  );
}
