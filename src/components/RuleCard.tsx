import { useMemo, useState } from "react";
import type { RulePreview } from "../lib/api";
import { countOf, useI18n } from "../lib/i18n";
import { FileIcon, FolderIcon } from "./icons";
import { EmptyState } from "./states";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Checkbox } from "./ui/Checkbox";
import { Input } from "./ui/Input";
import { VirtualList } from "./VirtualList";

const ROW_HEIGHT = 36;

const RISK_TONE = { low: "success", medium: "primary" } as const;

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
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <div className="pt-0.5">
          <Checkbox
            checked={all}
            indeterminate={some}
            onChange={(c) => onToggleRule(rule, c)}
            label={t.rule.selectAll(text.name)}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold">{text.name}</h3>
            <Badge tone={RISK_TONE[rule.risk]}>
              {rule.risk === "low" ? t.rule.riskLow : t.rule.riskMedium}
            </Badge>
          </div>
          <p className="text-sm text-muted">{text.description}</p>
          {notes.length > 0 && (
            <p className="text-xs text-muted" title={rule.rootProblems.join("\n")}>
              {notes.join(" ")}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-lg font-bold">{fmt.bytes(rule.totalBytes)}</div>
          <div className="font-mono text-xs text-muted">
            {countOf(i18n, rule.items.length, t.units.items)}
            {chosen.length > 0 && chosen.length < rule.items.length && (
              <> · {t.rule.selectedPart(fmt.bytes(chosenBytes))}</>
            )}
          </div>
          {rule.items.length > 0 && (
            <Button
              size="sm"
              onClick={() => setExpanded((x) => !x)}
              aria-expanded={expanded}
              className="mt-2"
            >
              {expanded ? t.rule.hideDetails : t.rule.showDetails}
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t-2 border-line bg-sunken">
          <div className="flex items-center gap-3 px-4 py-3">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.rule.filter}
              aria-label={t.rule.filter}
              className="flex-1"
            />
            {needle && (
              <span className="shrink-0 font-mono text-xs text-muted">
                {t.rule.filtered(fmt.count(visible.length), fmt.count(rule.items.length))}
              </span>
            )}
          </div>
          {visible.length === 0 ? (
            <EmptyState text={t.rule.noMatch} />
          ) : (
            <VirtualList
              key={needle}
              className="max-h-72 border-t-2 border-line bg-surface"
              count={visible.length}
              rowHeight={ROW_HEIGHT}
              renderRow={(i) => {
                const item = visible[i];
                // For project folders (node_modules) the project's date is what counts.
                const date = item.projectModified ?? item.modified;
                return (
                  <label className="grid h-full cursor-pointer grid-cols-[1.25rem_1rem_minmax(0,1fr)_6rem_7rem] items-center gap-3 border-b border-line/15 px-4 text-sm hover:bg-primary-soft">
                    <Checkbox
                      checked={selected.has(item.itemId)}
                      onChange={(c) => onToggleItem(item.itemId, c)}
                      label={item.path}
                    />
                    {item.isDir ? (
                      <FolderIcon className="size-4 fill-primary" />
                    ) : (
                      <FileIcon className="size-4 text-muted" />
                    )}
                    <span className="truncate font-mono text-xs" title={item.path} dir="rtl">
                      <bdi>{item.path}</bdi>
                    </span>
                    <span className="text-right font-mono text-xs font-bold">
                      {fmt.bytes(item.size)}
                    </span>
                    <span
                      className="text-xs text-muted"
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
    </Card>
  );
}
