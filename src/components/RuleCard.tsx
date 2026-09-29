import { useEffect, useMemo, useRef, useState } from "react";
import type { RulePreview } from "../lib/api";
import { countOf, useI18n } from "../lib/i18n";
import { FileIcon, FolderIcon } from "./icons";
import { EmptyState } from "./states";
import { VirtualList } from "./VirtualList";

const ROW_HEIGHT = 36;

const RISK_CLASS = {
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
} as const;

function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={label}
      className="size-4 shrink-0 accent-blue-600"
    />
  );
}

interface Props {
  rule: RulePreview;
  selected: ReadonlySet<number>;
  onToggleRule: (rule: RulePreview, checked: boolean) => void;
  onToggleItem: (itemId: number, checked: boolean) => void;
}

export function RuleCard({ rule, selected, onToggleRule, onToggleItem }: Props) {
  const i18n = useI18n();
  const { t, fmt } = i18n;
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");

  // Rules come from the config in Indonesian; show a translation when there is one.
  const text = t.rule.names[rule.id] ?? { name: rule.name, description: rule.description };
  const chosen = rule.items.filter((i) => selected.has(i.itemId));
  const chosenBytes = chosen.reduce((sum, i) => sum + i.size, 0);
  const all = rule.items.length > 0 && chosen.length === rule.items.length;
  const some = chosen.length > 0 && !all;

  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () => (needle ? rule.items.filter((i) => i.path.toLowerCase().includes(needle)) : rule.items),
    [rule.items, needle],
  );

  const notes: string[] = [];
  if (rule.truncated) notes.push(t.rule.truncated(fmt.count(rule.items.length)));
  if (rule.excludedCount > 0) {
    notes.push(t.rule.excluded(countOf(i18n, rule.excludedCount, t.units.items)));
  }
  if (rule.unreadableCount > 0) notes.push(t.rule.unreadable(fmt.count(rule.unreadableCount)));
  if (rule.rootProblems.length > 0) notes.push(t.rule.rootProblems(rule.rootProblems.length));

  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-700">
      <div className="flex items-start gap-3 p-4">
        <div className="pt-1">
          <Checkbox
            checked={all}
            indeterminate={some}
            onChange={(c) => onToggleRule(rule, c)}
            label={t.rule.selectAll(text.name)}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{text.name}</h3>
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${RISK_CLASS[rule.risk]}`}>
              {rule.risk === "low" ? t.rule.riskLow : t.rule.riskMedium}
            </span>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{text.description}</p>
          {notes.length > 0 && (
            <p className="text-xs text-zinc-500" title={rule.rootProblems.join("\n")}>
              {notes.join(" ")}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-semibold tabular-nums">{fmt.bytes(rule.totalBytes)}</div>
          <div className="text-xs tabular-nums text-zinc-500">
            {countOf(i18n, rule.items.length, t.units.items)}
            {chosen.length > 0 && chosen.length < rule.items.length && (
              <> · {t.rule.selectedPart(fmt.bytes(chosenBytes))}</>
            )}
          </div>
          {rule.items.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((x) => !x)}
              aria-expanded={expanded}
              className="mt-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              {expanded ? t.rule.hideDetails : t.rule.showDetails}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-3 px-4 py-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.rule.filter}
              aria-label={t.rule.filter}
              className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
            />
            {needle && (
              <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                {t.rule.filtered(fmt.count(visible.length), fmt.count(rule.items.length))}
              </span>
            )}
          </div>
          {visible.length === 0 ? (
            <EmptyState text={t.rule.noMatch} />
          ) : (
            <VirtualList
              key={needle}
              className="max-h-72"
              count={visible.length}
              rowHeight={ROW_HEIGHT}
              renderRow={(i) => {
                const item = visible[i];
                // For project folders (node_modules) the project's date is what counts.
                const date = item.projectModified ?? item.modified;
                return (
                  <label className="grid h-full cursor-pointer grid-cols-[1rem_1rem_minmax(0,1fr)_6rem_7rem] items-center gap-3 border-b border-zinc-100 px-4 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60">
                    <Checkbox
                      checked={selected.has(item.itemId)}
                      onChange={(c) => onToggleItem(item.itemId, c)}
                      label={item.path}
                    />
                    {item.isDir ? (
                      <FolderIcon className="size-4 text-amber-500" />
                    ) : (
                      <FileIcon className="size-4 text-zinc-400" />
                    )}
                    <span className="truncate" title={item.path} dir="rtl">
                      <bdi>{item.path}</bdi>
                    </span>
                    <span className="text-right tabular-nums">{fmt.bytes(item.size)}</span>
                    <span
                      className="text-zinc-500"
                      title={
                        item.projectModified !== null
                          ? t.rule.projectModified(fmt.date(item.projectModified))
                          : undefined
                      }
                    >
                      {fmt.date(date)}
                    </span>
                  </label>
                );
              }}
            />
          )}
        </div>
      )}
    </section>
  );
}
