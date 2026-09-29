import type { CleanupResult } from "../lib/api";
import { itemReason } from "../lib/errors";
import { countOf, useI18n } from "../lib/i18n";

interface Props {
  result: CleanupResult;
  onDone: () => void;
}

export function CleanupResultView({ result, onDone }: Props) {
  const i18n = useI18n();
  const { t, fmt } = i18n;
  const failed = result.items.filter((i) => i.error);
  return (
    <section className="space-y-4">
      <div
        role="status"
        className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40"
      >
        <p className="font-medium">
          {t.cleanupResult.moved(
            countOf(i18n, result.trashedCount, t.units.items),
            fmt.bytes(result.trashedBytes),
          )}
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t.cleanupResult.restoreNote}</p>
      </div>

      {failed.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium">
            {t.cleanupResult.skippedTitle(countOf(i18n, failed.length, t.units.items))}
          </h3>
          <ul className="max-h-72 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-700">
            {failed.map((i) => (
              <li key={i.itemId} className="flex gap-3 px-3 py-2">
                <span className="min-w-0 flex-1 truncate" title={i.path} dir="rtl">
                  <bdi>{i.path || `#${i.itemId}`}</bdi>
                </span>
                <span className="shrink-0 text-zinc-500" title={i.error?.message}>
                  {itemReason(t, i.error?.code ?? "")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={onDone}
        className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
      >
        {t.cleanupResult.done}
      </button>
    </section>
  );
}
