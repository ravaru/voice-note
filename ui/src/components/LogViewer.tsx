import React from "react";

type Props = {
  logs: string[];
};

export default function LogViewer({ logs }: Props) {
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
      {logs.length === 0 && <div>Логов пока нет.</div>}
      {logs.map((line, idx) => (
        <div key={idx} style={{ fontFamily: "monospace", fontSize: 12 }}>
          {line}
        </div>
      ))}
    </div>
  );
}
