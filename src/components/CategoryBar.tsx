import { useCallback } from "react";
import { useAsync } from "../hooks/useAsync";
import { getCategorySummary, type ScanId } from "../lib/api";
import { categoryStyle } from "../lib/categories";
import { errorMessage } from "../lib/errors";
import { countOf, useI18n } from "../lib/i18n";
import { ErrorState } from "./states";

interface Props {
  scanId: ScanId;
  nodeId: number;
}

/** Stacked bar + legend: how much of the current folder is video, photos, archives, ... */
export function CategoryBar({ scanId, nodeId }: Props) {
  const i18n = useI18n();
  const { t, fmt } = i18n;
  const load = useCallback(() => getCategorySummary(scanId, nodeId), [scanId, nodeId]);
  const summary = useAsync(load);

  if (summary.status === "error") {
    return <ErrorState message={errorMessage(t, summary.error)} onRetry={summary.retry} />;
  }
  const items = summary.status === "done" ? summary.data : [];
  const total = items.reduce((sum, c) => sum + c.size, 0);

  return (
    <section aria-label={t.categories.label} className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        {summary.status === "loading" && <div className="h-full w-full animate-pulse" />}
        {total > 0 &&
          items.map((c) => {
            const style = categoryStyle(t, c.key);
            return (
              <div
                key={c.key}
                className={`h-full ${style.color}`}
                style={{ width: `${(c.size / total) * 100}%` }}
                title={`${style.label}: ${fmt.bytes(c.size)}`}
              />
            );
          })}
      </div>
      <ul className="flex min-h-5 flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
        {summary.status === "done" && items.length === 0 && <li>{t.categories.empty}</li>}
        {items.map((c) => {
          const style = categoryStyle(t, c.key);
          return (
            <li
              key={c.key}
              className="flex items-center gap-1.5"
              title={countOf(i18n, c.fileCount, t.units.files)}
            >
              <span className={`size-2.5 rounded-full ${style.color}`} />
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{style.label}</span>
              <span className="tabular-nums">
                {fmt.bytes(c.size)} · {fmt.percent(total > 0 ? (c.size / total) * 100 : 0)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
