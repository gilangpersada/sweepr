import { m } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CleanupResultView } from "../components/CleanupResultView";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { RefreshIcon, TrashIcon } from "../components/icons";
import { RuleCard } from "../components/RuleCard";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PAGE_BODY, SECTION_TITLE } from "../components/ui/styles";
import {
  executeCleanup,
  listCleanerRules,
  previewCleanup,
  type CleanupPreview,
  type CleanupResult,
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

export function Cleaner() {
  const i18n = useI18n();
  const { t, fmt } = i18n;
  const [view, setView] = useState<View>({ kind: "loading" });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const showPreview = useCallback((v: View) => {
    if (v.kind === "ready") setSelected(defaultSelection(v.preview));
    setView(v);
  }, []);

  useEffect(() => {
    let alive = true;
    loadPreview().then((v) => alive && showPreview(v));
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
    } catch (e) {
      setConfirming(false);
      setNotice(errorMessage(t, e));
      // The preview is gone or stale: make a fresh one so the list matches the disk.
      if (errorCode(e) === "previewExpired" || errorCode(e) === "unknownPreview") reload();
    } finally {
      setBusy(false);
    }
  }

  // Rule cards appear one after another across both groups.
  let cardIndex = 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-6 border-b-[3px] border-line bg-surface px-6 py-4">
        <h1 className="flex-1 text-xl font-bold">{t.cleaner.title}</h1>
        <Button icon={<RefreshIcon />} onClick={reload} disabled={view.kind === "loading" || busy}>
          {t.cleaner.reload}
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className={PAGE_BODY}>
          {notice && (
            <Card tone="primary" shadow="sm" role="alert" className="p-3 text-sm font-medium">
              {notice}
            </Card>
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
                <section key={group} aria-labelledby={`group-${group}`} className="space-y-4">
                  <div>
                    <h2 id={`group-${group}`} className={SECTION_TITLE}>
                      {title}
                    </h2>
                    {hint && <p className="text-sm text-muted">{hint}</p>}
                  </div>
                  {rules.map((rule) => (
                    <m.div
                      key={rule.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: cardIndex++ * 0.06, duration: 0.25, ease: "easeOut" }}
                    >
                      <RuleCard
                        rule={rule}
                        selected={selected}
                        onToggleRule={toggleRule}
                        onToggleItem={toggleItem}
                      />
                    </m.div>
                  ))}
                </section>
              );
            })}

          {/* Floats at the bottom while scrolling and settles under the last card; same
              width as the list so it reads as part of it. */}
          {preview && !nothingFound && (
            <Card className="sticky bottom-4 z-10 flex flex-wrap items-center gap-4 px-5 py-3">
              <div className="flex-1 text-sm">
                {t.cleaner.selected}{" "}
                <span className="font-mono font-bold">
                  {selectedItems} · {fmt.bytes(selectedBytes)}
                </span>
                {tooMany && (
                  <span className="ml-2 font-bold text-danger-ink">
                    {t.cleaner.tooMany(fmt.count(preview.maxItems))}
                  </span>
                )}
              </div>
              <Button
                variant="primary"
                disabled={selected.size === 0 || tooMany || busy}
                onClick={() => setConfirming(true)}
              >
                {t.cleaner.next}
              </Button>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title={t.cleaner.confirmTitle}
        tone="danger"
        confirmIcon={<TrashIcon />}
        confirmLabel={t.cleaner.confirmButton}
        busy={busy}
        onConfirm={() => void execute()}
        onCancel={() => setConfirming(false)}
      >
        <p className="font-bold">
          {t.cleaner.confirmLead(selectedItems, fmt.bytes(selectedBytes))}
        </p>
        <p className="text-muted">{t.cleaner.confirmNote}</p>
      </ConfirmDialog>
    </div>
  );
}
