import { useCallback } from "react";
import { useAsync } from "../hooks/useAsync";
import { getLargestFiles, type ScanId } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { useI18n } from "../lib/i18n";
import { FileIcon } from "./icons";
import { RowActions } from "./RowActions";
import { EmptyState, ErrorState, LoadingState } from "./states";
import { VirtualList } from "./VirtualList";

/** How many files the tab lists. The backend caps a single call at 5000. */
const LIMIT = 1000;
const ROW_HEIGHT = 48;
const GRID = "grid grid-cols-[2.5rem_minmax(0,1fr)_6.5rem_7.5rem_4.5rem] items-center gap-3 px-3";

interface Props {
  scanId: ScanId;
  notify: (message: string) => void;
}

export function LargestFiles({ scanId, notify }: Props) {
  const { t, fmt } = useI18n();
  const load = useCallback(() => getLargestFiles(scanId, LIMIT), [scanId]);
  const result = useAsync(load);

  if (result.status === "loading") return <LoadingState />;
  if (result.status === "error") {
    return <ErrorState message={errorMessage(t, result.error)} onRetry={result.retry} />;
  }
  const files = result.data;
  if (files.length === 0) return <EmptyState text={t.table.noFiles} />;

  const header = (
    <div
      role="row"
      className={`${GRID} h-9 border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800`}
    >
      <div role="columnheader" className="text-right">
        #
      </div>
      <div role="columnheader">{t.table.nameAndLocation}</div>
      <div role="columnheader" className="text-right">
        {t.table.size}
      </div>
      <div role="columnheader">{t.table.modified}</div>
      <div role="columnheader" className="text-right">
        {t.table.actions}
      </div>
    </div>
  );

  return (
    <VirtualList
      className="min-h-0 flex-1"
      count={files.length}
      rowHeight={ROW_HEIGHT}
      header={header}
      renderRow={(i) => {
        const f = files[i];
        return (
          <div
            className={`${GRID} h-full border-b border-zinc-100 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60`}
          >
            <div role="cell" className="text-right text-xs tabular-nums text-zinc-400">
              {i + 1}
            </div>
            <div role="cell" className="flex min-w-0 items-center gap-2">
              <FileIcon className="size-4 shrink-0 text-zinc-400" />
              <div className="min-w-0">
                <div className="truncate" title={f.name}>
                  {f.name}
                </div>
                <div className="truncate text-xs text-zinc-500" title={f.path} dir="rtl">
                  <bdi>{f.path}</bdi>
                </div>
              </div>
            </div>
            <div role="cell" className="text-right tabular-nums">
              {fmt.bytes(f.size)}
            </div>
            <div role="cell" className="text-zinc-600 dark:text-zinc-400">
              {fmt.date(f.modified)}
            </div>
            <div role="cell">
              <RowActions scanId={scanId} nodeId={f.id} path={f.path} notify={notify} />
            </div>
          </div>
        );
      }}
    />
  );
}
