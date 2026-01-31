import React from "react";

export type PillTone = "neutral" | "success" | "warning" | "error" | "info";

type Props = {
  children: React.ReactNode;
  tone?: PillTone;
};

const toneClass: Record<PillTone, string> = {
  neutral: "badge badge-muted",
  info: "badge badge-info",
  success: "badge badge-success",
  warning: "badge badge-warning",
  error: "badge badge-error",
};

export default function Pill({ children, tone = "neutral" }: Props) {
  return <span className={toneClass[tone]}>{children}</span>;
}
