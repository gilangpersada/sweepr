import { useState } from "react";
import { DriveCard } from "../components/DriveCard";
import { ProgressBanner } from "../components/ProgressBanner";
import { useAsync } from "../hooks/useAsync";
import type { ScanState } from "../hooks/useScan";
import { listDrives, pickFolder } from "../lib/api";
import { errorMessage } from "../lib/errors";

interface Props {
  scan: ScanState;
  onScan: (path: string) => void;
  onCancel: () => void;
}

export function Home({ scan, onScan, onCancel }: Props) {
  const drives = useAsync(listDrives);
  const [pickError, setPickError] = useState<string | null>(null);
  const scanning = scan.status === "scanning";

  async function chooseFolder() {
    setPickError(null);
    try {
      const path = await pickFolder();
      if (path) onScan(path);
    } catch (e) {
      setPickError(errorMessage(e));
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 overflow-y-auto p-8">
      <header>
        <h1 className="text-3xl font-semibold">Sweepr</h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          Lihat apa yang memakan ruang disk, lalu bersihkan dengan aman.
        </p>
      </header>

      {scan.status === "scanning" && (
        <ProgressBanner path={scan.path} progress={scan.progress} onCancel={onCancel} />
      )}
      {scan.status === "cancelled" && (
        <p className="rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-800">Scan dibatalkan.</p>
      )}
      {scan.status === "failed" && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          Scan gagal: {errorMessage(scan.error)}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Drive</h2>
        {drives.status === "loading" && <p className="text-sm text-zinc-500">Memuat drive…</p>}
        {drives.status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400">{errorMessage(drives.error)}</p>
        )}
        {drives.status === "done" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {drives.data.map((d) => (
              <DriveCard key={d.mountPoint} drive={d} disabled={scanning} onScan={onScan} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Folder</h2>
        <button
          type="button"
          disabled={scanning}
          onClick={() => void chooseFolder()}
          className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Pilih folder…
        </button>
        {pickError && <p className="text-sm text-red-600 dark:text-red-400">{pickError}</p>}
      </section>
    </div>
  );
}
