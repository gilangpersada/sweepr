import { useCallback, useEffect, useRef } from "react";
import { useAsync } from "../hooks/useAsync";
import { getSkipped, type ScanId } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { countOf, useI18n } from "../lib/i18n";
import { EmptyState, ErrorState, LoadingState } from "./states";
import { VirtualList } from "./VirtualList";

/** Most rows fetched at once; the backend caps a page at 5000. */
const LIMIT = 5000;
const ROW_HEIGHT = 44;

interface Props {
  scanId: ScanId;
  onClose: () => void;
}

/** FR-2: the folders and files a scan could not read. Mount it only while it is open. */
export function SkippedDialog({ scanId, onClose }: Props) {
  const i18n = useI18n();
  const { t } = i18n;
  const ref = useRef<HTMLDialogElement>(null);
  const load = useCallback(() => getSkipped(scanId, 0, LIMIT), [scanId]);
  const page = useAsync(load);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="skipped-title"
      className="m-auto flex max-h-[80vh] w-full max-w-3xl flex-col rounded-lg bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-black/40 dark:bg-zinc-800 dark:text-zinc-100"
    >
      <div className="space-y-1 p-6 pb-3">
        <h2 id="skipped-title" className="text-lg font-semibold">
          {t.skipped.title}
          {page.status === "done" && (
            <span className="ml-2 text-sm font-normal text-zinc-500">
              ({countOf(i18n, page.data.total, t.units.items)})
            </span>
          )}
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{t.skipped.intro}</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-6">
        {page.status === "loading" && <LoadingState />}
        {page.status === "error" && (
          <ErrorState message={errorMessage(t, page.error)} onRetry={page.retry} />
        )}
        {page.status === "done" && page.data.items.length === 0 && (
          <EmptyState text={t.skipped.empty} />
        )}
        {page.status === "done" && page.data.items.length > 0 && (
          <VirtualList
            className="max-h-[50vh] rounded-lg border border-zinc-200 dark:border-zinc-700"
            count={page.data.items.length}
            rowHeight={ROW_HEIGHT}
            renderRow={(i) => {
              const item = page.data.items[i];
              return (
                <div className="flex h-full flex-col justify-center border-b border-zinc-100 px-3 text-sm dark:border-zinc-700">
                  <span className="truncate" title={item.path} dir="rtl">
                    <bdi>{item.path}</bdi>
                  </span>
                  <span className="truncate text-xs text-zinc-500" title={item.reason}>
                    {item.reason}
                  </span>
                </div>
              );
            }}
          />
        )}
      </div>

      <div className="flex justify-end p-6 pt-4">
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-700"
        >
          {t.common.close}
        </button>
      </div>
    </dialog>
  );
}
