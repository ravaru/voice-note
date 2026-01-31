import React from "react";
import { useI18n } from "../i18n/I18nProvider";

type Props = {
  logs: string[];
};

export default function LogViewer({ logs }: Props) {
  const { t } = useI18n();
  return (
    <div
      style={{
        border: "1px solid #ccc",
        padding: 12,
        height: 160,
        overflow: "auto",
        background: "#fafafa",
      }}
    >
      {logs.length === 0 && <div>{t("logs.empty")}</div>}
      {logs.map((line, idx) => (
        <div key={idx} style={{ fontFamily: "monospace", fontSize: 12 }}>
          {line}
        </div>
      ))}
    </div>
  );
}
