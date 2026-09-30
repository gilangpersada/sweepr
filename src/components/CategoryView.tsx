import { m } from "motion/react";
import { useCallback, useState } from "react";
import { useAsync } from "../hooks/useAsync";
import { getCategorySummary, type CategorySize, type ScanId } from "../lib/api";
import { categoryStyle } from "../lib/categories";
import { errorMessage } from "../lib/errors";
import { countOf, useI18n } from "../lib/i18n";
import { CategoryFiles } from "./CategoryFiles";
import { EmptyState, ErrorState, LoadingState } from "./states";
import { Card } from "./ui/Card";

interface Props {
  scanId: ScanId;
  nodeId: number;
  notify: (message: string) => void;
}

const ROW = "grid grid-cols-[minmax(0,1fr)_6.5rem_minmax(0,12rem)_6rem] items-center gap-4 px-4";
/** Segments at least this wide (% of the bar) carry their name and percent inside. */
const LABEL_MIN_PCT = 9;

/**
 * "Categories" tab: how much of the current folder is video, photos, archives, ... Clicking a
 * category (bar segment, legend or row) lists its files (D-040).
 */
export function CategoryView({ scanId, nodeId, notify }: Props) {
  const i18n = useI18n();
  const { t, fmt } = i18n;
  const load = useCallback(() => getCategorySummary(scanId, nodeId), [scanId, nodeId]);
  const summary = useAsync(load);
  const [open, setOpen] = useState<string | null>(null);

  if (summary.status === "loading") return <LoadingState />;
  if (summary.status === "error") {
    return <ErrorState message={errorMessage(t, summary.error)} onRetry={summary.retry} />;
  }
  const items = summary.data;
  const total = items.reduce((sum, c) => sum + c.size, 0);
  if (items.length === 0 || total === 0) return <EmptyState text={t.categories.empty} />;
  const pct = (size: number) => (size / total) * 100;

  // Stays open while moving through folders; closes if the new folder has none of it.
  const openRow = items.find((c) => c.key === open);
  if (openRow) {
    return (
      <CategoryFiles
        scanId={scanId}
        nodeId={nodeId}
        category={openRow.key}
        size={openRow.size}
        fileCount={openRow.fileCount}
        onBack={() => setOpen(null)}
        notify={notify}
      />
    );
  }

  const describe = (c: CategorySize) =>
    t.categories.segment(
      categoryStyle(t, c.key).label,
      fmt.bytes(c.size),
      fmt.percent(pct(c.size)),
      countOf(i18n, c.fileCount, t.units.files),
    );

  return (
    <section aria-label={t.categories.label} className="space-y-4">
      {/* Stacked bar: each segment is a button with its own border; wide ones are labelled. */}
      <div className="flex h-12 overflow-hidden rounded-card border-2 border-line bg-surface shadow-hard">
        {items.map((c) => {
          const style = categoryStyle(t, c.key);
          const share = pct(c.size);
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setOpen(c.key)}
              title={describe(c)}
              aria-label={`${t.categories.showFiles(style.label)} — ${describe(c)}`}
              className={`flex h-full min-w-0 flex-col items-start justify-center overflow-hidden border-r-2 border-line px-2 text-left text-on-accent last:border-r-0 hover:brightness-110 focus-visible:relative focus-visible:z-10 ${style.color}`}
              style={{ width: `${share}%` }}
            >
              {share >= LABEL_MIN_PCT && (
                <>
                  <span className="w-full truncate text-xs font-bold">{style.label}</span>
                  <span className="w-full truncate font-mono text-xs">{fmt.percent(share)}</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend: every category, also the ones too small to label inside the bar. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
        {items.map((c) => {
          const style = categoryStyle(t, c.key);
          return (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => setOpen(c.key)}
                title={describe(c)}
                className="flex items-center gap-1.5 hover:underline hover:decoration-2 hover:underline-offset-2"
              >
                <span
                  aria-hidden="true"
                  className={`size-3 shrink-0 rounded-sm border-2 border-line ${style.color}`}
                />
                <span className="font-bold">{style.label}</span>
                <span className="font-mono text-muted">{fmt.percent(pct(c.size))}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-muted">{t.categories.hint}</p>

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
              className={`${ROW} h-11 border-b border-line/15 text-sm last:border-b-0 hover:bg-primary-soft`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
            >
              <div role="cell" className="min-w-0">
                <button
                  type="button"
                  onClick={() => setOpen(c.key)}
                  title={t.categories.showFiles(style.label)}
                  className="flex min-w-0 items-center gap-2 font-bold hover:underline hover:decoration-2 hover:underline-offset-2"
                >
                  <span
                    aria-hidden="true"
                    className={`size-4 shrink-0 rounded-sm border-2 border-line ${style.color}`}
                  />
                  <span className="truncate">{style.label}</span>
                  <span aria-hidden="true" className="text-muted">
                    ›
                  </span>
                </button>
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
