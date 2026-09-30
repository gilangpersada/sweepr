// Shared loading / empty / error states so every screen looks and reads the same.
import { useI18n } from "../lib/i18n";
import { AlertIcon } from "./icons";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 animate-spin rounded-full border-[3px] border-line border-t-primary motion-reduce:animate-none ${className}`}
    />
  );
}

export function LoadingState({ text }: { text?: string }) {
  const { t } = useI18n();
  return (
    <p role="status" className="flex items-center gap-3 p-4 text-sm font-medium text-muted">
      <Spinner />
      {text ?? t.common.loading}
    </p>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <p className="p-4 text-sm text-muted">{text}</p>;
}

/** Error message with an optional "Try again". */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <Card
      tone="danger"
      shadow="sm"
      role="alert"
      className="flex flex-wrap items-center gap-3 p-3 text-sm"
    >
      <AlertIcon className="size-5 shrink-0" />
      <span className="flex-1 font-medium">{message}</span>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          {t.common.retry}
        </Button>
      )}
    </Card>
  );
}
