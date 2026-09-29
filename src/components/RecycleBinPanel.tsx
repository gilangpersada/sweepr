import { useState } from "react";
import { emptyRecycleBin, type RecycleBinInfo } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { formatBytes, formatCount } from "../lib/format";
import { ConfirmDialog } from "./ConfirmDialog";

interface Props {
  info: RecycleBinInfo | null;
  /** Called after emptying so the caller can refresh `info`. */
  onChanged: () => void;
}

/** Recycle Bin size plus the only permanent delete in the app, behind its own confirmation. */
export function RecycleBinPanel({ info, onChanged }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const empty = info !== null && info.itemCount === 0;

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await emptyRecycleBin();
      setConfirming(false);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-wrap items-center gap-4 rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
      <div className="min-w-0 flex-1">
        <div className="font-medium">
          Recycle Bin:{" "}
          {info
            ? `${formatBytes(info.sizeBytes)} (${formatCount(info.itemCount)} item)`
            : "memuat…"}
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          File yang dibersihkan dipindah ke sini dan masih bisa dipulihkan. Ruang disk baru
          benar-benar kosong setelah Recycle Bin dikosongkan.
        </p>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
      <button
        type="button"
        disabled={empty || info === null}
        onClick={() => setConfirming(true)}
        className="rounded-md border border-red-400 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        Kosongkan Recycle Bin…
      </button>

      <ConfirmDialog
        open={confirming}
        title="Kosongkan Recycle Bin?"
        tone="danger"
        confirmLabel="Hapus permanen"
        busy={busy}
        onConfirm={() => void run()}
        onCancel={() => setConfirming(false)}
      >
        <p>
          Semua isi Recycle Bin di semua drive
          {info && (
            <>
              {" "}
              (<strong>{formatCount(info.itemCount)} item</strong>,{" "}
              <strong>{formatBytes(info.sizeBytes)}</strong>)
            </>
          )}{" "}
          akan dihapus permanen, termasuk file yang Anda buang sendiri di luar Sweepr.
        </p>
        <p className="font-medium text-red-600 dark:text-red-400">
          Tindakan ini tidak bisa dibatalkan.
        </p>
      </ConfirmDialog>
    </section>
  );
}
