import React from "react";

type Props = {
  left: React.ReactNode;
  right: React.ReactNode;
};

export default function SplitPane({ left, right }: Props) {
  return (
    <div className="split-pane">
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}
