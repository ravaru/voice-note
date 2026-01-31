import React from "react";

type Props = React.HTMLAttributes<HTMLDivElement>;

export default function Card({ className = "", ...rest }: Props) {
  return <div {...rest} className={`card ${className}`.trim()} />;
}
