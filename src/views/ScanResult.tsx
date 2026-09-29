import { useCallback, useEffect, useRef, useState } from "react";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb";
import { CategoryBar } from "../components/CategoryBar";
import { FolderTable, type Sort } from "../components/FolderTable";
import { LargestFiles } from "../components/LargestFiles";
import type { NodeView, ScanFinishedEvent } from "../lib/api";
import { formatBytes, formatCount } from "../lib/format";

interface Props {
  result: ScanFinishedEvent;
  onHome: () => void;
  onRescan: (path: string) => void;
  onOpenCleaner: () => void;
  /** False while another page covers this one; disables keyboard shortcuts. */
  active: boolean;
}

type Tab = "folders" | "largest";

const TOAST_MS = 2500;

export function ScanResult({ result, onHome, onRescan, onOpenCleaner, active }: Props) {
  const { scanId, rootId, rootPath } = result;
  const [tab, setTab] = useState<Tab>("folders");
  const [trail, setTrail] = useState<Crumb[]>([{ id: rootId, name: rootPath }]);
  const [sort, setSort] = useState<Sort>({ sortBy: "size", order: "desc" });
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

  // Backspace goes up one folder, like Explorer.
  useEffect(() => {
    if (tab !== "folders" || !active) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key !== "Backspace" || target?.closest("input, textarea")) return;
      e.preventDefault();
      setTrail((t) => (t.length > 1 ? t.slice(0, -1) : t));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, active]);

  const tabClass = (t: Tab) =>
    `border-b-2 px-3 py-2 text-sm font-medium ${
      tab === t
        ? "border-blue-600 text-blue-600 dark:text-blue-400"
        : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
    }`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-zinc-200 px-6 py-3 dark:border-zinc-700">
        <button
          type="button"
          onClick={onHome}
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Beranda
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold" title={rootPath}>
            {rootPath}
          </div>
          <div className="text-xs tabular-nums text-zinc-500">
            {formatBytes(result.totalBytes)} · {formatCount(result.totalFiles)} file · selesai dalam{" "}
            {(result.elapsedMs / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} detik
            {result.skippedCount > 0 && (
              <span title="Biasanya folder sistem yang aksesnya ditolak. Ukurannya tidak dihitung.">
                {" "}
                · {formatCount(result.skippedCount)} item tidak bisa dibaca
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRescan(rootPath)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Scan ulang
        </button>
        <button
          type="button"
          onClick={onOpenCleaner}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Pembersih
        </button>
      </header>

      <div role="tablist" className="flex gap-2 border-b border-zinc-200 px-6 dark:border-zinc-700">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "folders"}
          onClick={() => setTab("folders")}
          className={tabClass("folders")}
        >
          Folder
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "largest"}
          onClick={() => setTab("largest")}
          className={tabClass("largest")}
        >
          File Terbesar
        </button>
      </div>

      {tab === "folders" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 pt-4">
          <Breadcrumb trail={trail} onNavigate={(i) => setTrail((t) => t.slice(0, i + 1))} />
          <CategoryBar scanId={scanId} nodeId={current.id} />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-lg border border-b-0 border-zinc-200 dark:border-zinc-700">
            <FolderTable
              scanId={scanId}
              nodeId={current.id}
              sort={sort}
              onSortChange={setSort}
              onOpen={open}
              notify={notify}
            />
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col px-6 pt-4">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-lg border border-b-0 border-zinc-200 dark:border-zinc-700">
            <LargestFiles scanId={scanId} notify={notify} />
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
