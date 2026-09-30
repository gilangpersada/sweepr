import type { InputHTMLAttributes } from "react";

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`min-w-0 rounded-control border-2 border-line bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-muted ${className}`}
      {...rest}
    />
  );
}
