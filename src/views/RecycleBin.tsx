import { useCallback, useEffect, useState } from "react";
import { BinList } from "../components/BinList";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { AlertIcon, CheckIcon, RefreshIcon, TrashIcon, UndoIcon } from "../components/icons";
import { ErrorState, LoadingState } from "../components/states";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { CountUp } from "../components/ui/CountUp";
import { SECTION_TITLE } from "../components/ui/styles";
import {
  emptyRecycleBin,
  getRecycleBinInfo,
  listRecycleBin,
  restoreFromRecycleBin,
  type BinListing,
  type RecycleBinInfo,
  type RestoreResult,
} from "../lib/api";
import { errorMessage } from "../lib/errors";
import { countOf, useI18n } from "../lib/i18n";

type Load<T> = { kind: "loading" } | { kind: "ready"; data: T } | { kind: "error"; error: unknown };

interface Props {
  /** Shown right now: refresh on every visit, the cleaner may have added items. */
  active: boolean;
}

/**
 * Recycle Bin: size, contents with "Restore" (D-039), and the only permanent delete in the
 * app behind its own confirmation (D-003).
 */
export function RecycleBin({ active }: Props) {
  const i18n = useI18n();
  const { t, fmt } = i18n;
  const [info, setInfo] = useState<Load<RecycleBinInfo>>({ kind: "loading" });
  const [listing, setListing] = useState<Load<BinListing>>({ kind: "loading" });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirm, setConfirm] = useState<"empty" | "restore" | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [restored, setRestored] = useState<RestoreResult | null>(null);

  // Keeps the old numbers on screen while refreshing, so the page does not jump. A new list
  // replaces the old one in the backend, so the selection starts over.
  const refresh = useCallback(() => {
    getRecycleBinInfo().then(
      (data) => setInfo({ kind: "ready", data }),
      (error: unknown) => setInfo({ kind: "error", error }),
    );
    listRecycleBin().then(
      (data) => {
        setListing({ kind: "ready", data });
        setSelected(new Set());
      },
      (error: unknown) => setListing({ kind: "error", error }),
    );
  }, []);

  useEffect(() => {
    if (active) refresh();
  }, [active, refresh]);

  const bin = info.kind === "ready" ? info.data : null;
  const list = listing.kind === "ready" ? listing.data : null;
  const items = bin ? countOf(i18n, bin.itemCount, t.units.items) : "";
  const sizes = new Map(list?.items.map((i) => [i.itemId, i.size]) ?? []);
  const selectedBytes = [...selected].reduce((sum, id) => sum + (sizes.get(id) ?? 0), 0);
  const selectedItems = countOf(i18n, selected.size, t.units.items);

  const select = useCallback((ids: number[], checked: boolean) => {
    setSelected((s) => {
      const next = new Set(s);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  async function runEmpty() {
    setBusy(true);
    setNotice(null);
    setRestored(null);
    try {
      await emptyRecycleBin();
    } catch (e) {
      setNotice(errorMessage(t, e));
    } finally {
      setConfirm(null);
      setBusy(false);
      refresh();
    }
  }

  async function runRestore() {
    if (!list) return;
    setBusy(true);
    setNotice(null);
    try {
      setRestored(await restoreFromRecycleBin(list.listId, [...selected]));
    } catch (e) {
      // E.g. the list is too old; the refresh below makes a fresh one that matches the bin.
      setNotice(errorMessage(t, e));
      setRestored(null);
    } finally {
      setConfirm(null);
      setBusy(false);
      refresh();
    }
  }

  const failed = restored?.items.filter((i) => i.error) ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-6 border-b-[3px] border-line bg-surface px-6 py-4">
        <h1 className="flex-1 text-xl font-bold">{t.recycleBin.title}</h1>
        <Button icon={<RefreshIcon />} onClick={refresh} disabled={busy}>
          {t.common.refresh}
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
          <p className="text-muted">{t.recycleBin.explain}</p>

          {info.kind === "loading" && <LoadingState text={t.recycleBin.loading} />}
          {info.kind === "error" && (
            <ErrorState message={errorMessage(t, info.error)} onRetry={refresh} />
          )}
          {bin && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Card className="space-y-1 p-5">
                <div className={SECTION_TITLE}>{t.recycleBin.size}</div>
                <div className="font-mono text-3xl font-bold">
                  <CountUp value={bin.sizeBytes} format={fmt.bytes} />
                </div>
              </Card>
              <Card className="space-y-1 p-5">
                <div className={SECTION_TITLE}>{t.recycleBin.items}</div>
                <div className="font-mono text-3xl font-bold">{items}</div>
              </Card>
            </div>
          )}

          {notice && <ErrorState message={notice} />}

          {restored && (
            <Card tone="success" role="status" className="space-y-3 p-5">
              <div className="flex items-center gap-3">
                <CheckIcon className="size-6 shrink-0" />
                <p className="font-bold">
                  {t.recycleBin.restored(
                    countOf(i18n, restored.restoredCount, t.units.items),
                    fmt.bytes(restored.restoredBytes),
                  )}
                </p>
              </div>
              {failed.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold">
                    {t.recycleBin.restoreSkipped(countOf(i18n, failed.length, t.units.items))}
                  </h3>
                  <ul className="max-h-48 divide-y divide-line/15 overflow-y-auto rounded-control border-2 border-line bg-surface text-sm">
                    {failed.map((o) => (
                      <li key={o.itemId} className="flex gap-3 px-3 py-2">
                        <span
                          className="min-w-0 flex-1 truncate font-mono text-xs"
                          dir="rtl"
                          title={o.path}
                        >
                          <bdi>{o.path || `#${o.itemId}`}</bdi>
                        </span>
                        <span className="shrink-0 text-muted" title={o.error?.message}>
                          {t.restoreReasons[o.error?.code ?? ""] ?? o.error?.code}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {listing.kind === "loading" && <LoadingState text={t.recycleBin.loadingList} />}
          {listing.kind === "error" && (
            <ErrorState message={errorMessage(t, listing.error)} onRetry={refresh} />
          )}
          {list && (
            <BinList
              listing={list}
              selected={selected}
              onSelect={select}
              onRestore={() => setConfirm("restore")}
              busy={busy}
            />
          )}

          {bin && (
            <Card tone="danger" className="flex flex-wrap items-center gap-4 p-5">
              <AlertIcon className="size-6 shrink-0" />
              <p className="min-w-0 flex-1 text-sm font-bold">
                {bin.itemCount === 0 ? t.recycleBin.isEmpty : t.recycleBin.cannotUndo}
              </p>
              {/* The only permanent delete in the app (D-003): danger color + icon + text. */}
              <Button
                variant="danger"
                icon={<TrashIcon />}
                disabled={bin.itemCount === 0 || busy}
                onClick={() => setConfirm("empty")}
              >
                {t.recycleBin.empty}
              </Button>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm === "restore"}
        title={t.recycleBin.restoreTitle}
        confirmIcon={<UndoIcon />}
        confirmLabel={t.recycleBin.restoreButton}
        busy={busy}
        onConfirm={() => void runRestore()}
        onCancel={() => setConfirm(null)}
      >
        <p className="font-bold">
          {t.recycleBin.restoreLead(selectedItems, fmt.bytes(selectedBytes))}
        </p>
        <p className="text-muted">{t.recycleBin.restoreNote}</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === "empty"}
        title={t.recycleBin.confirmTitle}
        tone="danger"
        confirmIcon={<TrashIcon />}
        confirmLabel={t.recycleBin.confirmButton}
        busy={busy}
        onConfirm={() => void runEmpty()}
        onCancel={() => setConfirm(null)}
      >
        {bin && <p>{t.recycleBin.confirmLead(items, fmt.bytes(bin.sizeBytes))}</p>}
        <p className="font-bold text-danger-ink">{t.recycleBin.cannotUndo}</p>
      </ConfirmDialog>
    </div>
  );
}
