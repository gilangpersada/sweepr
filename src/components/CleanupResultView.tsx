import type { CleanupResult } from "../lib/api";
import { itemReason } from "../lib/errors";
import { countOf, useI18n } from "../lib/i18n";
import { CheckIcon } from "./icons";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { CountUp } from "./ui/CountUp";

interface Props {
  result: CleanupResult;
  onDone: () => void;
}

export function CleanupResultView({ result, onDone }: Props) {
  const i18n = useI18n();
  const { t, fmt } = i18n;
  const failed = result.items.filter((i) => i.error);
  return (
    <section className="space-y-5">
      <Card tone="success" role="status" className="flex items-start gap-4 p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-control border-2 border-line bg-success text-on-accent">
          <CheckIcon className="size-6" />
        </span>
        <div className="space-y-1">
          <p className="font-mono text-2xl font-bold">
            <CountUp value={result.trashedBytes} format={fmt.bytes} />
          </p>
          <p className="font-bold">
            {t.cleanupResult.moved(
              countOf(i18n, result.trashedCount, t.units.items),
              fmt.bytes(result.trashedBytes),
            )}
          </p>
          <p className="text-sm text-muted">{t.cleanupResult.restoreNote}</p>
        </div>
      </Card>

      {failed.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-bold">
            {t.cleanupResult.skippedTitle(countOf(i18n, failed.length, t.units.items))}
          </h3>
          <Card shadow="sm" className="max-h-72 overflow-y-auto">
            <ul className="divide-y divide-line/15 text-sm">
              {failed.map((i) => (
                <li key={i.itemId} className="flex gap-3 px-3 py-2">
                  <span
                    className="min-w-0 flex-1 truncate font-mono text-xs"
                    title={i.path}
                    dir="rtl"
                  >
                    <bdi>{i.path || `#${i.itemId}`}</bdi>
                  </span>
                  <span className="shrink-0 text-muted" title={i.error?.message}>
                    {itemReason(t, i.error?.code ?? "")}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <Button variant="primary" onClick={onDone}>
        {t.cleanupResult.done}
      </Button>
    </section>
  );
}
