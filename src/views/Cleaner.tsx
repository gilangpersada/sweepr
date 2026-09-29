import { useCallback, useEffect, useMemo, useState } from "react";
import { CleanupResultView } from "../components/CleanupResultView";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { RecycleBinPanel } from "../components/RecycleBinPanel";
import { RuleCard } from "../components/RuleCard";
import {
  executeCleanup,
  getRecycleBinInfo,
  listCleanerRules,
  previewCleanup,
  type CleanupPreview,
  type CleanupResult,
  type RecycleBinInfo,
  type RuleGroup,
  type RulePreview,
} from "../lib/api";
import { errorCode, errorMessage } from "../lib/errors";
import { formatBytes, formatCount } from "../lib/format";

type View =
  | { kind: "loading" }
  | { kind: "ready"; preview: CleanupPreview }
  | { kind: "done"; result: CleanupResult }
  | { kind: "error"; error: unknown };

/** Items of rules that are checked by default (only low-risk rules may be, see rules loader). */
function defaultSelection(p: CleanupPreview): Set<number> {
  return new Set(
    p.rules.filter((r) => r.defaultChecked).flatMap((r) => r.items.map((i) => i.itemId)),
  );
}

/** Sections of the screen, in display order. */
const GROUPS: { id: RuleGroup; title: string; hint?: string }[] = [
  { id: "general", title: "Umum" },
  {
    id: "developer",
    title: "Cache Developer",
    hint: "Untuk developer: folder yang bisa dibuat ulang dari project (mis. npm install). Tidak dicentang otomatis; project yang masih aktif tidak ikut.",
  },
];

/** Previews every rule; the UI decides what is checked. */
async function loadPreview(): Promise<View> {
  try {
    const rules = await listCleanerRules();
    return { kind: "ready", preview: await previewCleanup(rules.map((r) => r.id)) };
  } catch (error) {
    return { kind: "error", error };
  }
}

interface Props {
  onBack: () => void;
}

export function Cleaner({ onBack }: Props) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [bin, setBin] = useState<RecycleBinInfo | null>(null);

  const showPreview = useCallback((v: View) => {
    if (v.kind === "ready") setSelected(defaultSelection(v.preview));
    setView(v);
  }, []);

  const refreshBin = useCallback(() => {
    getRecycleBinInfo().then(setBin, () => setBin(null));
  }, []);

  useEffect(() => {
    let alive = true;
    loadPreview().then((v) => alive && showPreview(v));
    getRecycleBinInfo().then(
      (info) => alive && setBin(info),
      () => alive && setBin(null),
    );
    return () => {
      alive = false;
    };
  }, [showPreview]);

  function reload() {
    setView({ kind: "loading" });
    void loadPreview().then(showPreview);
  }

  const preview = view.kind === "ready" ? view.preview : null;
  const sizes = useMemo(
    () => new Map(preview?.rules.flatMap((r) => r.items.map((i) => [i.itemId, i.size])) ?? []),
    [preview],
  );
  const selectedBytes = [...selected].reduce((sum, id) => sum + (sizes.get(id) ?? 0), 0);
  const tooMany = preview !== null && selected.size > preview.maxItems;

  const toggleRule = useCallback((rule: RulePreview, checked: boolean) => {
    setSelected((s) => {
      const next = new Set(s);
      for (const i of rule.items) {
        if (checked) next.add(i.itemId);
        else next.delete(i.itemId);
      }
      return next;
    });
  }, []);

  const toggleItem = useCallback((itemId: number, checked: boolean) => {
    setSelected((s) => {
      const next = new Set(s);
      if (checked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }, []);

  async function execute() {
    if (!preview) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await executeCleanup(preview.previewId, [...selected]);
      setConfirming(false);
      setView({ kind: "done", result });
      refreshBin();
    } catch (e) {
      setConfirming(false);
      setNotice(errorMessage(e));
      // The preview is gone or stale: make a fresh one so the list matches the disk.
      if (errorCode(e) === "previewExpired" || errorCode(e) === "unknownPreview") reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-6 border-b border-zinc-200 px-6 py-3 dark:border-zinc-700">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Kembali
        </button>
        <h1 className="flex-1 font-semibold">Pembersih</h1>
        <button
          type="button"
          onClick={reload}
          disabled={view.kind === "loading" || busy}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Muat ulang
        </button>
      </header>

      <div className="mx-auto w-full max-w-4xl flex-1 space-y-4 overflow-y-auto p-6">
        <RecycleBinPanel info={bin} onChanged={refreshBin} />
        {notice && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            {notice}
          </p>
        )}

        {view.kind === "loading" && (
          <p className="flex items-center gap-3 text-sm text-zinc-500">
            <span className="size-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            Mencari file yang bisa dibersihkan… (bisa beberapa detik)
          </p>
        )}
        {view.kind === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400">{errorMessage(view.error)}</p>
        )}
        {view.kind === "done" && <CleanupResultView result={view.result} onDone={reload} />}
        {preview &&
          GROUPS.map((group) => {
            const rules = preview.rules.filter((r) => r.group === group.id);
            if (rules.length === 0) return null;
            return (
              <section key={group.id} aria-labelledby={`group-${group.id}`} className="space-y-3">
                <div>
                  <h2
                    id={`group-${group.id}`}
                    className="text-sm font-semibold uppercase tracking-wide text-zinc-500"
                  >
                    {group.title}
                  </h2>
                  {group.hint && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{group.hint}</p>
                  )}
                </div>
                {rules.map((rule) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    selected={selected}
                    onToggleRule={toggleRule}
                    onToggleItem={toggleItem}
                  />
                ))}
              </section>
            );
          })}
      </div>

      {preview && (
        <footer className="flex flex-wrap items-center gap-4 border-t border-zinc-200 px-6 py-3 dark:border-zinc-700">
          <div className="flex-1 text-sm">
            Dipilih:{" "}
            <span className="font-semibold tabular-nums">
              {formatCount(selected.size)} item · {formatBytes(selectedBytes)}
            </span>
            {tooMany && (
              <span className="ml-2 text-red-600 dark:text-red-400">
                Maksimal {formatCount(preview.maxItems)} item sekali jalan.
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={selected.size === 0 || tooMany || busy}
            onClick={() => setConfirming(true)}
            className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Lanjut ke konfirmasi
          </button>
        </footer>
      )}

      <ConfirmDialog
        open={confirming}
        title="Pindahkan ke Recycle Bin?"
        confirmLabel="Pindahkan ke Recycle Bin"
        busy={busy}
        onConfirm={() => void execute()}
        onCancel={() => setConfirming(false)}
      >
        <p>
          <strong>{formatCount(selected.size)} item</strong> dengan total{" "}
          <strong>{formatBytes(selectedBytes)}</strong> akan dipindah ke Recycle Bin.
        </p>
        <p>
          Item masih bisa dipulihkan dari Recycle Bin. Ruang disk baru kosong setelah Recycle Bin
          dikosongkan. Item yang berubah sejak daftar ini dibuat akan dilewati.
        </p>
      </ConfirmDialog>
    </div>
  );
}
