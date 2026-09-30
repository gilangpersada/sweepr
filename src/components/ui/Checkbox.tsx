import { useEffect, useRef } from "react";

interface Props {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

/** Native checkbox (keyboard, forms, screen readers) drawn as a Neo-Brutalism box. */
export function Checkbox({ checked, indeterminate = false, onChange, label }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <span className="relative inline-flex size-5 shrink-0">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        className="peer size-5 cursor-pointer appearance-none rounded-sm border-2 border-line bg-surface checked:bg-primary indeterminate:bg-primary"
      />
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 m-auto hidden size-3.5 text-on-accent peer-checked:block peer-indeterminate:hidden"
      >
        <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth={2.5} />
      </svg>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 m-auto hidden h-0.5 w-2.5 bg-on-accent peer-indeterminate:block"
      />
    </span>
  );
}
