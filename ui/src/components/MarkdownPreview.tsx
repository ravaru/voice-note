import React from "react";

type Props = {
  markdown: string;
};

// Simple preformatted preview; no markdown rendering for MVP.
export default function MarkdownPreview({ markdown }: Props) {
  return (
    <pre
      style={{
        background: "#f8f8f8",
        padding: 12,
        border: "1px solid #ddd",
        whiteSpace: "pre-wrap",
      }}
    >
      {markdown}
    </pre>
  );
}
