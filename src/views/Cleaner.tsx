import { useCallback, useEffect, useMemo, useState } from "react";
import { CleanupResultView } from "../components/CleanupResultView";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { RecycleBinPanel } from "../components/RecycleBinPanel";
import { RuleCard } from "../components/RuleCard";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
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
import { countOf, useI18n, type Messages } from "../lib/i18n";

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
const GROUPS: RuleGroup[] = ["general", "developer"];

function groupText(t: Messages, group: RuleGroup): { title: string; hint?: string } {
  return group === "general"
    ? { title: t.cleaner.groupGeneral }
    : { title: t.cleaner.groupDeveloper, hint: t.cleaner.groupDeveloperHint };
}

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
  const i18n = useI18n();
  const { t, fmt } = i18n;
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
  const selectedItems = countOf(i18n, selected.size, t.units.items);
  const tooMany = preview !== null && selected.size > preview.maxItems;
  const nothingFound = preview !== null && preview.rules.every((r) => r.items.length === 0);

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
      setNotice(errorMessage(t, e));
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
          {t.common.back}
        </button>
        <h1 className="flex-1 font-semibold">{t.cleaner.title}</h1>
        <button
          type="button"
          onClick={reload}
          disabled={view.kind === "loading" || busy}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {t.cleaner.reload}
        </button>
      </header>

      <div className="mx-auto w-full max-w-4xl flex-1 space-y-4 overflow-y-auto p-6">
        <RecycleBinPanel info={bin} onChanged={refreshBin} />
        {notice && (
          <p
            role="alert"
            className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
          >
            {notice}
          </p>
        )}

        {view.kind === "loading" && <LoadingState text={t.cleaner.searching} />}
        {view.kind === "error" && (
          <ErrorState message={errorMessage(t, view.error)} onRetry={reload} />
        )}
        {view.kind === "done" && <CleanupResultView result={view.result} onDone={reload} />}
        {nothingFound && <EmptyState text={t.cleaner.nothingFound} />}
        {preview &&
          GROUPS.map((group) => {
            const rules = preview.rules.filter((r) => r.group === group);
            if (rules.length === 0) return null;
            const { title, hint } = groupText(t, group);
            return (
              <section key={group} aria-labelledby={`group-${group}`} className="space-y-3">
                <div>
                  <h2
                    id={`group-${group}`}
                    className="text-sm font-semibold uppercase tracking-wide text-zinc-500"
                  >
                    {title}
                  </h2>
                  {hint && <p className="text-sm text-zinc-600 dark:text-zinc-400">{hint}</p>}
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
            {t.cleaner.selected}{" "}
            <span className="font-semibold tabular-nums">
              {selectedItems} · {fmt.bytes(selectedBytes)}
            </span>
            {tooMany && (
              <span className="ml-2 text-red-600 dark:text-red-400">
                {t.cleaner.tooMany(fmt.count(preview.maxItems))}
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={selected.size === 0 || tooMany || busy}
            onClick={() => setConfirming(true)}
            className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {t.cleaner.next}
          </button>
        </footer>
      )}

      <ConfirmDialog
        open={confirming}
        title={t.cleaner.confirmTitle}
        confirmLabel={t.cleaner.confirmButton}
        busy={busy}
        onConfirm={() => void execute()}
        onCancel={() => setConfirming(false)}
      >
        <p className="font-medium">
          {t.cleaner.confirmLead(selectedItems, fmt.bytes(selectedBytes))}
        </p>
        <p>{t.cleaner.confirmNote}</p>
      </ConfirmDialog>
    </div>
  );
}
