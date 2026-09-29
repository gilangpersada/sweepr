// Shared loading / empty / error states so every screen looks and reads the same.
import { useI18n } from "../lib/i18n";

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-blue-600 border-t-transparent ${className}`}
    />
  );
}

export function LoadingState({ text }: { text?: string }) {
  const { t } = useI18n();
  return (
    <p role="status" className="flex items-center gap-3 p-4 text-sm text-zinc-500">
      <Spinner />
      {text ?? t.common.loading}
    </p>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <p className="p-4 text-sm text-zinc-500">{text}</p>;
}

/** Error message with an optional "Try again". */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
    >
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-red-300 px-3 py-1 font-medium hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900/40"
        >
          {t.common.retry}
        </button>
      )}
    </div>
  );
}
