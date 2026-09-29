import { useState } from "react";
import { emptyRecycleBin, type RecycleBinInfo } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { countOf, useI18n } from "../lib/i18n";
import { ConfirmDialog } from "./ConfirmDialog";
import { ErrorState } from "./states";

interface Props {
  info: RecycleBinInfo | null;
  /** Called after emptying so the caller can refresh `info`. */
  onChanged: () => void;
}

/** Recycle Bin size plus the only permanent delete in the app, behind its own confirmation. */
export function RecycleBinPanel({ info, onChanged }: Props) {
  const i18n = useI18n();
  const { t, fmt } = i18n;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const empty = info !== null && info.itemCount === 0;
  const items = info ? countOf(i18n, info.itemCount, t.units.items) : "";

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await emptyRecycleBin();
      setConfirming(false);
      onChanged();
    } catch (e) {
      setError(errorMessage(t, e));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-wrap items-center gap-4 rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="font-medium">
          {t.recycleBin.label}{" "}
          {info ? `${fmt.bytes(info.sizeBytes)} (${items})` : t.recycleBin.loading}
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t.recycleBin.explain}</p>
        {error && <ErrorState message={error} />}
      </div>
      <button
        type="button"
        disabled={empty || info === null}
        onClick={() => setConfirming(true)}
        className="rounded-md border border-red-400 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        {t.recycleBin.empty}
      </button>

      <ConfirmDialog
        open={confirming}
        title={t.recycleBin.confirmTitle}
        tone="danger"
        confirmLabel={t.recycleBin.confirmButton}
        busy={busy}
        onConfirm={() => void run()}
        onCancel={() => setConfirming(false)}
      >
        {info && <p>{t.recycleBin.confirmLead(items, fmt.bytes(info.sizeBytes))}</p>}
        <p className="font-medium text-red-600 dark:text-red-400">{t.recycleBin.cannotUndo}</p>
      </ConfirmDialog>
    </section>
  );
}
