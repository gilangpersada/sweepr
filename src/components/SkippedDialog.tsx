import { useCallback } from "react";
import { useAsync } from "../hooks/useAsync";
import { getSkipped, type ScanId } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { countOf, useI18n } from "../lib/i18n";
import { EmptyState, ErrorState, LoadingState } from "./states";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";
import { VirtualList } from "./VirtualList";

/** Most rows fetched at once; the backend caps a page at 5000. */
const LIMIT = 5000;
const ROW_HEIGHT = 44;

interface Props {
  open: boolean;
  scanId: ScanId;
  onClose: () => void;
}

/** FR-2: the folders and files a scan could not read. */
export function SkippedDialog({ open, scanId, onClose }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      labelledBy="skipped-title"
      className="flex max-h-[80vh] max-w-3xl flex-col"
    >
      <SkippedList scanId={scanId} onClose={onClose} />
    </Dialog>
  );
}

/** Mounted only while the dialog is open, so the list is fetched on demand. */
function SkippedList({ scanId, onClose }: Omit<Props, "open">) {
  const i18n = useI18n();
  const { t } = i18n;
  const load = useCallback(() => getSkipped(scanId, 0, LIMIT), [scanId]);
  const page = useAsync(load);

  return (
    <>
      <div className="space-y-1 p-6 pb-3">
        <h2 id="skipped-title" className="text-lg font-bold">
          {t.skipped.title}
          {page.status === "done" && (
            <span className="ml-2 font-mono text-sm font-normal text-muted">
              ({countOf(i18n, page.data.total, t.units.items)})
            </span>
          )}
        </h2>
        <p className="text-sm text-muted">{t.skipped.intro}</p>
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
            className="max-h-[50vh] rounded-control border-2 border-line"
            count={page.data.items.length}
            rowHeight={ROW_HEIGHT}
            renderRow={(i) => {
              const item = page.data.items[i];
              return (
                <div className="flex h-full flex-col justify-center border-b border-line/15 px-3 text-sm">
                  <span className="truncate font-mono text-xs" title={item.path} dir="rtl">
                    <bdi>{item.path}</bdi>
                  </span>
                  <span className="truncate text-xs text-muted" title={item.reason}>
                    {item.reason}
                  </span>
                </div>
              );
            }}
          />
        )}
      </div>

      <div className="flex justify-end p-6 pt-4">
        <Button onClick={onClose} data-autofocus>
          {t.common.close}
        </Button>
      </div>
    </>
  );
}
