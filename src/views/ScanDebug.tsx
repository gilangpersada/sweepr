// Minimal M1 screen to exercise the scanner end to end. The real result UI comes in M2.
import { useEffect, useState } from "react";
import { useScan } from "../hooks/useScan";
import {
  getChildren,
  getLargestFiles,
  listDrives,
  type DriveInfo,
  type FileView,
  type NodeView,
} from "../lib/api";
import { formatBytes, formatCount } from "../lib/format";

export function ScanDebug() {
  const { state, start, cancel } = useScan();
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [path, setPath] = useState("");
  const [children, setChildren] = useState<NodeView[]>([]);
  const [largest, setLargest] = useState<FileView[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listDrives()
      .then(setDrives)
      .catch((e: unknown) => setError(String(e)));
  }, []);

  const finished = state.status === "finished" ? state.result : null;
  useEffect(() => {
    if (!finished) return;
    const { scanId, rootId } = finished;
    Promise.all([
      getChildren({ scanId, nodeId: rootId, sortBy: "size", order: "desc", offset: 0, limit: 20 }),
      getLargestFiles(scanId, 10),
    ])
      .then(([page, files]) => {
        setChildren(page.items);
        setLargest(files);
      })
      .catch((e: unknown) => setError(JSON.stringify(e)));
  }, [finished]);

  function run(target: string) {
    setChildren([]);
    setLargest([]);
    setError(null);
    start(target).catch((e: unknown) => setError(String(e)));
  }

  const scanning = state.status === "scanning";

  return (
    <div className="mt-6 space-y-6">
      <section className="flex flex-wrap gap-3">
        {drives.map((d) => (
          <button
            key={d.mountPoint}
            type="button"
            disabled={scanning}
            onClick={() => run(d.mountPoint)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-left hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <div className="font-medium">
              {d.mountPoint} {d.name && `(${d.name})`}
            </div>
            <div className="text-sm text-zinc-500">
              {formatBytes(d.availableBytes)} sisa dari {formatBytes(d.totalBytes)}
            </div>
          </button>
        ))}
      </section>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (path.trim()) run(path.trim());
        }}
      >
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="Path folder, mis. C:\Users\nama\Downloads"
          className="flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={scanning}
          className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Scan
        </button>
        {scanning && (
          <button
            type="button"
            onClick={cancel}
            className="rounded-md border border-red-500 px-4 py-2 text-red-600 dark:text-red-400"
          >
            Batal
          </button>
        )}
      </form>

      <section className="text-sm" data-testid="scan-status">
        {state.status === "scanning" && (
          <p>
            Memindai… {formatCount(state.progress?.filesSeen ?? 0)} file,{" "}
            {formatBytes(state.progress?.bytesSeen ?? 0)}
            <span className="block truncate text-zinc-500">{state.progress?.currentPath}</span>
          </p>
        )}
        {state.status === "cancelled" && <p>Scan dibatalkan.</p>}
        {state.status === "failed" && (
          <p className="text-red-600 dark:text-red-400">Gagal: {state.error.message}</p>
        )}
        {finished && (
          <p>
            Selesai: {formatBytes(finished.totalBytes)} dalam {formatCount(finished.totalFiles)}{" "}
            file, {formatCount(finished.skippedCount)} dilewati,{" "}
            {(finished.elapsedMs / 1000).toFixed(1)} detik.
          </p>
        )}
        {error && <p className="text-red-600 dark:text-red-400">Error: {error}</p>}
      </section>

      {children.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Isi folder teratas</h2>
          <ul className="space-y-1 text-sm">
            {children.map((c) => (
              <li key={c.id} className="flex justify-between gap-4">
                <span className="truncate">
                  {c.isDir ? "📁" : "📄"} {c.name}
                </span>
                <span className="shrink-0 tabular-nums text-zinc-500">
                  {formatBytes(c.size)} · {c.percentOfParent.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {largest.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">10 file terbesar</h2>
          <ul className="space-y-1 text-sm">
            {largest.map((f) => (
              <li key={f.id} className="flex justify-between gap-4">
                <span className="truncate" title={f.path}>
                  {f.path}
                </span>
                <span className="shrink-0 tabular-nums text-zinc-500">{formatBytes(f.size)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
