import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { AlertIcon, RefreshIcon, TrashIcon } from "../components/icons";
import { ErrorState, LoadingState } from "../components/states";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { CountUp } from "../components/ui/CountUp";
import { SECTION_TITLE } from "../components/ui/styles";
import { emptyRecycleBin, getRecycleBinInfo, type RecycleBinInfo } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { countOf, useI18n } from "../lib/i18n";

type Info =
  { kind: "loading" } | { kind: "ready"; info: RecycleBinInfo } | { kind: "error"; error: unknown };

interface Props {
  /** Shown right now: refresh on every visit, the cleaner may have added items. */
  active: boolean;
}

/** Recycle Bin size plus the only permanent delete in the app, behind its own confirmation. */
export function RecycleBin({ active }: Props) {
  const i18n = useI18n();
  const { t, fmt } = i18n;
  const [state, setState] = useState<Info>({ kind: "loading" });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keeps the old numbers on screen while refreshing, so the page does not jump.
  const refresh = useCallback(() => {
    getRecycleBinInfo().then(
      (info) => setState({ kind: "ready", info }),
      (e: unknown) => setState({ kind: "error", error: e }),
    );
  }, []);

  useEffect(() => {
    if (active) refresh();
  }, [active, refresh]);

  const info = state.kind === "ready" ? state.info : null;
  const items = info ? countOf(i18n, info.itemCount, t.units.items) : "";

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await emptyRecycleBin();
      setConfirming(false);
      refresh();
    } catch (e) {
      setError(errorMessage(t, e));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-6 border-b-[3px] border-line bg-surface px-6 py-4">
        <h1 className="flex-1 text-xl font-bold">{t.recycleBin.title}</h1>
        <Button icon={<RefreshIcon />} onClick={refresh}>
          {t.common.refresh}
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
          <p className="text-muted">{t.recycleBin.explain}</p>

          {state.kind === "loading" && <LoadingState text={t.recycleBin.loading} />}
          {state.kind === "error" && (
            <ErrorState message={errorMessage(t, state.error)} onRetry={refresh} />
          )}
          {info && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Card className="space-y-1 p-5">
                <div className={SECTION_TITLE}>{t.recycleBin.size}</div>
                <div className="font-mono text-3xl font-bold">
                  <CountUp value={info.sizeBytes} format={fmt.bytes} />
                </div>
              </Card>
              <Card className="space-y-1 p-5">
                <div className={SECTION_TITLE}>{t.recycleBin.items}</div>
                <div className="font-mono text-3xl font-bold">{items}</div>
              </Card>
            </div>
          )}

          {error && <ErrorState message={error} />}

          {info && (
            <Card tone="danger" className="flex flex-wrap items-center gap-4 p-5">
              <AlertIcon className="size-6 shrink-0" />
              <p className="min-w-0 flex-1 text-sm font-bold">
                {info.itemCount === 0 ? t.recycleBin.isEmpty : t.recycleBin.cannotUndo}
              </p>
              {/* The only permanent delete in the app (D-003): danger color + icon + text. */}
              <Button
                variant="danger"
                icon={<TrashIcon />}
                disabled={info.itemCount === 0}
                onClick={() => setConfirming(true)}
              >
                {t.recycleBin.empty}
              </Button>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title={t.recycleBin.confirmTitle}
        tone="danger"
        confirmIcon={<TrashIcon />}
        confirmLabel={t.recycleBin.confirmButton}
        busy={busy}
        onConfirm={() => void run()}
        onCancel={() => setConfirming(false)}
      >
        {info && <p>{t.recycleBin.confirmLead(items, fmt.bytes(info.sizeBytes))}</p>}
        <p className="font-bold text-danger-ink">{t.recycleBin.cannotUndo}</p>
      </ConfirmDialog>
    </div>
  );
}
