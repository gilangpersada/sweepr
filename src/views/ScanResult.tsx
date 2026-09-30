import { AnimatePresence, m } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb";
import { CategoryView } from "../components/CategoryView";
import { FolderTable, type Sort } from "../components/FolderTable";
import { RefreshIcon } from "../components/icons";
import { LargestFiles } from "../components/LargestFiles";
import { SkippedDialog } from "../components/SkippedDialog";
import { Button } from "../components/ui/Button";
import { CountUp } from "../components/ui/CountUp";
import { Tabs } from "../components/ui/Tabs";
import type { NodeView, ScanFinishedEvent } from "../lib/api";
import { countOf, useI18n } from "../lib/i18n";

interface Props {
  result: ScanFinishedEvent;
  onRescan: (path: string) => void;
  /** False while another page is shown; disables keyboard shortcuts. */
  active: boolean;
}

type Tab = "folders" | "largest" | "categories";

const TOAST_MS = 2500;
/** Bordered frame around the tables. */
const TABLE_FRAME =
  "flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-card border-2 border-b-0 border-line bg-surface";

export function ScanResult({ result, onRescan, active }: Props) {
  const i18n = useI18n();
  const { t, fmt } = i18n;
  const { scanId, rootId, rootPath } = result;
  const [tab, setTab] = useState<Tab>("folders");
  const [trail, setTrail] = useState<Crumb[]>([{ id: rootId, name: rootPath }]);
  const [sort, setSort] = useState<Sort>({ sortBy: "size", order: "desc" });
  const [showSkipped, setShowSkipped] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const current = trail[trail.length - 1];

  const notify = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const open = useCallback((node: NodeView) => {
    setTrail((t) => [...t, { id: node.id, name: node.name }]);
  }, []);
  const navigate = (i: number) => setTrail((t) => t.slice(0, i + 1));

  // Backspace goes up one folder, like Explorer.
  useEffect(() => {
    if (tab === "largest" || !active || showSkipped) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key !== "Backspace" || target?.closest("input, textarea")) return;
      e.preventDefault();
      setTrail((t) => (t.length > 1 ? t.slice(0, -1) : t));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, active, showSkipped]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b-[3px] border-line bg-surface px-6 py-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold" title={rootPath}>
            {rootPath}
          </h1>
          <div className="font-mono text-xs text-muted">
            <span className="font-bold text-ink">
              <CountUp value={result.totalBytes} format={fmt.bytes} />
            </span>{" "}
            · {countOf(i18n, result.totalFiles, t.units.files)} ·{" "}
            {t.result.finishedIn(fmt.seconds(result.elapsedMs))}
            {result.skippedCount > 0 && (
              <>
                {" · "}
                <span title={t.result.unreadableHint}>
                  {t.result.unreadable(countOf(i18n, result.skippedCount, t.units.items))}
                </span>{" "}
                <button
                  type="button"
                  onClick={() => setShowSkipped(true)}
                  className="font-sans font-bold text-info-ink underline underline-offset-2"
                >
                  {t.result.showList}
                </button>
              </>
            )}
          </div>
        </div>
        <Button icon={<RefreshIcon />} onClick={() => onRescan(rootPath)}>
          {t.result.rescan}
        </Button>
      </header>

      <div className="px-6 pt-4">
        <Tabs
          label={t.result.tabsLabel}
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "folders", label: t.result.tabFolders },
            { id: "largest", label: t.result.tabLargest },
            { id: "categories", label: t.result.tabCategories },
          ]}
        />
      </div>

      {tab === "largest" ? (
        <div className="flex min-h-0 flex-1 flex-col px-6 pt-4">
          <div className={TABLE_FRAME}>
            <LargestFiles scanId={scanId} notify={notify} />
          </div>
        </div>
      ) : (
        // Folders and Categories share the folder position (breadcrumb).
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 pt-4">
          <Breadcrumb trail={trail} onNavigate={navigate} />
          {tab === "folders" ? (
            <div className={`@container ${TABLE_FRAME}`}>
              <FolderTable
                scanId={scanId}
                nodeId={current.id}
                sort={sort}
                onSortChange={setSort}
                onOpen={open}
                notify={notify}
              />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto pb-6">
              <CategoryView scanId={scanId} nodeId={current.id} notify={notify} />
            </div>
          )}
        </div>
      )}

      <SkippedDialog open={showSkipped} scanId={scanId} onClose={() => setShowSkipped(false)} />

      <AnimatePresence>
        {toast && (
          <m.div
            key="toast"
            role="status"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-control border-2 border-line bg-primary px-4 py-2 text-sm font-bold text-on-accent shadow-hard"
          >
            {toast}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
