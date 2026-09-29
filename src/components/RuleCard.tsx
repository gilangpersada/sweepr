import { useEffect, useRef, useState } from "react";
import type { RulePreview } from "../lib/api";
import { formatBytes, formatCount, formatDate } from "../lib/format";
import { FileIcon, FolderIcon } from "./icons";
import { VirtualList } from "./VirtualList";

const ROW_HEIGHT = 36;

const RISK = {
  low: {
    label: "Risiko rendah",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
  medium: {
    label: "Risiko sedang",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  },
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
  const [expanded, setExpanded] = useState(false);
  const chosen = rule.items.filter((i) => selected.has(i.itemId));
  const chosenBytes = chosen.reduce((sum, i) => sum + i.size, 0);
  const all = rule.items.length > 0 && chosen.length === rule.items.length;
  const some = chosen.length > 0 && !all;
  const risk = RISK[rule.risk];

  const notes: string[] = [];
  if (rule.truncated)
    notes.push(`Hanya ${formatCount(rule.items.length)} item terbesar ditampilkan.`);
  if (rule.excludedCount > 0) {
    notes.push(`${formatCount(rule.excludedCount)} item dikecualikan demi keamanan.`);
  }
  if (rule.unreadableCount > 0) {
    notes.push(`${formatCount(rule.unreadableCount)} folder/file tidak bisa dibaca.`);
  }
  if (rule.rootProblems.length > 0) {
    notes.push(`${rule.rootProblems.length} lokasi dilewati (tidak ada atau terlindungi).`);
  }

  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-700">
      <div className="flex items-start gap-3 p-4">
        <div className="pt-1">
          <Checkbox
            checked={all}
            indeterminate={some}
            onChange={(c) => onToggleRule(rule, c)}
            label={`Pilih semua: ${rule.name}`}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{rule.name}</h3>
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${risk.className}`}>
              {risk.label}
            </span>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{rule.description}</p>
          {notes.length > 0 && (
            <p className="text-xs text-zinc-500" title={rule.rootProblems.join("\n")}>
              {notes.join(" ")}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-semibold tabular-nums">{formatBytes(rule.totalBytes)}</div>
          <div className="text-xs tabular-nums text-zinc-500">
            {formatCount(rule.items.length)} item
            {chosen.length > 0 && chosen.length < rule.items.length && (
              <> · dipilih {formatBytes(chosenBytes)}</>
            )}
          </div>
          {rule.items.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((x) => !x)}
              aria-expanded={expanded}
              className="mt-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              {expanded ? "Sembunyikan detail" : "Lihat detail"}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <VirtualList
          className="max-h-72 border-t border-zinc-200 dark:border-zinc-700"
          count={rule.items.length}
          rowHeight={ROW_HEIGHT}
          renderRow={(i) => {
            const item = rule.items[i];
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
                <span className="text-right tabular-nums">{formatBytes(item.size)}</span>
                <span className="text-zinc-500">{formatDate(item.modified)}</span>
              </label>
            );
          }}
        />
      )}
    </section>
  );
}
