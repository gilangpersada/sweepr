import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "primary" | "danger" | "info" | "success";

const TONE: Record<BadgeTone, string> = {
  neutral: "bg-sunken text-ink",
  primary: "bg-primary text-on-accent",
  danger: "bg-danger text-on-accent",
  info: "bg-info text-on-accent",
  success: "bg-success text-on-accent",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border-2 border-line px-1.5 text-xs font-bold ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}
