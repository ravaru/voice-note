import React from "react";

type Props = {
  markdown: string;
};

export default function MarkdownPreview({ markdown }: Props) {
  return <pre className="markdown">{markdown}</pre>;
}
