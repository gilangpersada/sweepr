import { useCallback } from "react";
import { useAsync } from "../hooks/useAsync";
import { getCategorySummary, type ScanId } from "../lib/api";
import { categoryStyle } from "../lib/categories";
import { errorMessage } from "../lib/errors";
import { formatBytes, formatCount, formatPercent } from "../lib/format";

interface Props {
  scanId: ScanId;
  nodeId: number;
}

/** Stacked bar + legend: how much of the current folder is video, photos, archives, ... */
export function CategoryBar({ scanId, nodeId }: Props) {
  const load = useCallback(() => getCategorySummary(scanId, nodeId), [scanId, nodeId]);
  const summary = useAsync(load);

  if (summary.status === "error") {
    return <p className="text-sm text-red-600 dark:text-red-400">{errorMessage(summary.error)}</p>;
  }
  const items = summary.status === "done" ? summary.data : [];
  const total = items.reduce((sum, c) => sum + c.size, 0);

  return (
    <section aria-label="Ringkasan kategori" className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        {summary.status === "loading" && <div className="h-full w-full animate-pulse" />}
        {total > 0 &&
          items.map((c) => (
            <div
              key={c.key}
              className={`h-full ${categoryStyle(c.key).color}`}
              style={{ width: `${(c.size / total) * 100}%` }}
              title={`${categoryStyle(c.key).label}: ${formatBytes(c.size)}`}
            />
          ))}
      </div>
      <ul className="flex min-h-5 flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
        {summary.status === "done" && items.length === 0 && <li>Folder ini tidak berisi file.</li>}
        {items.map((c) => {
          const style = categoryStyle(c.key);
          return (
            <li
              key={c.key}
              className="flex items-center gap-1.5"
              title={`${formatCount(c.fileCount)} file`}
            >
              <span className={`size-2.5 rounded-full ${style.color}`} />
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{style.label}</span>
              <span className="tabular-nums">
                {formatBytes(c.size)} · {formatPercent(total > 0 ? (c.size / total) * 100 : 0)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
