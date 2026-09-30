import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

/**
 * Neo-Brutalism press feedback: the element lifts toward the viewer on hover (bigger shadow)
 * and sinks into its shadow when pressed. Movement only with motion allowed (`motion-safe`).
 * Shared with interactive cards.
 */
export const PRESSABLE =
  "transition-[translate,box-shadow] duration-100 enabled:hover:shadow-hard-lg enabled:motion-safe:hover:-translate-x-0.5 enabled:motion-safe:hover:-translate-y-0.5 enabled:active:shadow-none enabled:motion-safe:active:translate-x-1 enabled:motion-safe:active:translate-y-1";

const VARIANT: Record<ButtonVariant, string> = {
  primary: `border-2 border-line bg-primary text-on-accent shadow-hard ${PRESSABLE}`,
  secondary: `border-2 border-line bg-surface text-ink shadow-hard ${PRESSABLE}`,
  danger: `border-2 border-line bg-danger text-on-accent shadow-hard ${PRESSABLE}`,
  ghost: "border-2 border-transparent text-ink enabled:hover:border-line enabled:hover:bg-sunken",
};

const SIZE = {
  sm: "gap-1.5 px-2.5 py-1 text-sm",
  md: "gap-2 px-4 py-2",
  icon: "p-1.5",
} as const;

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: keyof typeof SIZE;
  icon?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  className = "",
  type = "button",
  children,
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center rounded-control font-bold disabled:cursor-not-allowed disabled:opacity-45 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
