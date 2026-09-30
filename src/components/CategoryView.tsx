import { m } from "motion/react";
import { useCallback } from "react";
import { useAsync } from "../hooks/useAsync";
import { getCategorySummary, type ScanId } from "../lib/api";
import { categoryStyle } from "../lib/categories";
import { errorMessage } from "../lib/errors";
import { useI18n } from "../lib/i18n";
import { EmptyState, ErrorState, LoadingState } from "./states";
import { Card } from "./ui/Card";

interface Props {
  scanId: ScanId;
  nodeId: number;
}

const ROW = "grid grid-cols-[minmax(0,1fr)_6.5rem_minmax(0,12rem)_6rem] items-center gap-4 px-4";

/** "Categories" tab: how much of the current folder is video, photos, archives, ... */
export function CategoryView({ scanId, nodeId }: Props) {
  const { t, fmt } = useI18n();
  const load = useCallback(() => getCategorySummary(scanId, nodeId), [scanId, nodeId]);
  const summary = useAsync(load);

  if (summary.status === "loading") return <LoadingState />;
  if (summary.status === "error") {
    return <ErrorState message={errorMessage(t, summary.error)} onRetry={summary.retry} />;
  }
  const items = summary.data;
  const total = items.reduce((sum, c) => sum + c.size, 0);
  if (items.length === 0 || total === 0) return <EmptyState text={t.categories.empty} />;
  const pct = (size: number) => (size / total) * 100;

  return (
    <section aria-label={t.categories.label} className="space-y-5">
      {/* Stacked bar: every segment has its own border so neighbours stay apart. */}
      <div className="flex h-10 overflow-hidden rounded-card border-2 border-line bg-surface shadow-hard">
        {items.map((c) => {
          const style = categoryStyle(t, c.key);
          return (
            <div
              key={c.key}
              className={`h-full border-r-2 border-line last:border-r-0 ${style.color}`}
              style={{ width: `${pct(c.size)}%` }}
              title={`${style.label}: ${fmt.bytes(c.size)}`}
            />
          );
        })}
      </div>

      <Card className="overflow-hidden" role="table">
        <div
          role="row"
          className={`${ROW} h-9 border-b-2 border-line bg-sunken text-xs font-bold uppercase tracking-wide`}
        >
          <div role="columnheader">{t.categories.category}</div>
          <div role="columnheader" className="text-right">
            {t.table.size}
          </div>
          <div role="columnheader">{t.categories.share}</div>
          <div role="columnheader" className="text-right">
            {t.categories.files}
          </div>
        </div>
        {items.map((c, i) => {
          const style = categoryStyle(t, c.key);
          return (
            <m.div
              key={c.key}
              role="row"
              className={`${ROW} h-11 border-b border-line/15 text-sm last:border-b-0`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
            >
              <div role="cell" className="flex min-w-0 items-center gap-2 font-bold">
                <span
                  aria-hidden="true"
                  className={`size-4 shrink-0 rounded-sm border-2 border-line ${style.color}`}
                />
                <span className="truncate">{style.label}</span>
              </div>
              <div role="cell" className="text-right font-mono text-xs font-bold">
                {fmt.bytes(c.size)}
              </div>
              <div role="cell" className="flex items-center gap-2">
                <div className="h-2.5 flex-1 overflow-hidden rounded-sm border border-line bg-surface">
                  <div className={`h-full ${style.color}`} style={{ width: `${pct(c.size)}%` }} />
                </div>
                <span className="w-12 text-right font-mono text-xs text-muted">
                  {fmt.percent(pct(c.size))}
                </span>
              </div>
              <div role="cell" className="text-right font-mono text-xs text-muted">
                {fmt.count(c.fileCount)}
              </div>
            </m.div>
          );
        })}
      </Card>
    </section>
  );
}
