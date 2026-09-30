import { m, useReducedMotion } from "motion/react";

export type BarTone = "primary" | "danger" | "info" | "success";

const FILL: Record<BarTone, string> = {
  primary: "bg-primary",
  danger: "bg-danger",
  info: "bg-info",
  success: "bg-success",
};

interface Props {
  /** 0–100. Leave out for "working, amount unknown" (a block sliding across). */
  value?: number;
  tone?: BarTone;
  label: string;
  className?: string;
}

/**
 * Bordered bar. A known value grows smoothly from 0 when it first appears and whenever it
 * changes. With reduced motion the change is instant and the "unknown" block stands still
 * (width/left are not transforms, so MotionConfig alone would not stop them).
 */
export function ProgressBar({ value, tone = "primary", label, className = "h-4" }: Props) {
  const reduce = useReducedMotion();
  const known = value !== undefined;
  const pct = known ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={known ? 0 : undefined}
      aria-valuemax={known ? 100 : undefined}
      aria-valuenow={known ? Math.round(pct) : undefined}
      className={`relative overflow-hidden rounded-sm border-2 border-line bg-surface ${className}`}
    >
      {known ? (
        <m.div
          className={`h-full ${pct > 0 && pct < 100 ? "border-r-2 border-line" : ""} ${FILL[tone]}`}
          initial={{ width: reduce ? `${pct}%` : "0%" }}
          animate={{ width: `${pct}%` }}
          transition={reduce ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }}
        />
      ) : reduce ? (
        <div className={`h-full w-full opacity-60 ${FILL[tone]}`} />
      ) : (
        <m.div
          className={`absolute inset-y-0 w-1/3 border-x-2 border-line ${FILL[tone]}`}
          initial={{ left: "-33%" }}
          animate={{ left: ["-33%", "100%"] }}
          transition={{ duration: 1.2, ease: "easeInOut", repeat: Infinity }}
        />
      )}
    </div>
  );
}
