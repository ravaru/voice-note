import React from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export default function Button({ variant = "secondary", className = "", ...rest }: Props) {
  return (
    <button
      {...rest}
      className={`btn btn-${variant} ${className}`.trim()}
    />
  );
}
