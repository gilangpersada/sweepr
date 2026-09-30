import type { HTMLAttributes } from "react";

export type Tone = "neutral" | "primary" | "danger" | "info" | "success";

/** Background per tone; text stays `text-ink`, which passes AA on every soft tint. */
const TONE_SOFT: Record<Tone, string> = {
  neutral: "bg-surface",
  primary: "bg-primary-soft",
  danger: "bg-danger-soft",
  info: "bg-info-soft",
  success: "bg-success-soft",
};

interface Props extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  /** `sm` for panels nested inside other cards. */
  shadow?: "sm" | "md" | "none";
}

const SHADOW = { sm: "shadow-hard-sm", md: "shadow-hard", none: "" } as const;

export function Card({ tone = "neutral", shadow = "md", className = "", ...rest }: Props) {
  return (
    <div
      className={`rounded-card border-2 border-line text-ink ${TONE_SOFT[tone]} ${SHADOW[shadow]} ${className}`}
      {...rest}
    />
  );
}
