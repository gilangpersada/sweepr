import { useMemo, useState } from "react";
import type { BinItem, BinListing } from "../lib/api";
import { countOf, useI18n } from "../lib/i18n";
import { FileIcon, FolderIcon, UndoIcon } from "./icons";
import { EmptyState } from "./states";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Checkbox } from "./ui/Checkbox";
import { Input } from "./ui/Input";
import { SECTION_TITLE } from "./ui/styles";
import { VirtualList } from "./VirtualList";

const ROW_HEIGHT = 48;
// The drive column only shows when the bin holds items from more than one drive.
const GRID = "grid items-center gap-3 px-3";
const COLS_ONE_DRIVE = "grid-cols-[1.25rem_minmax(0,1fr)_6.5rem_7.5rem]";
const COLS_DRIVES = "grid-cols-[1.25rem_minmax(0,1fr)_3.5rem_6.5rem_7.5rem]";

type SortKey = "name" | "size" | "deleted";

interface Props {
  listing: BinListing;
  selected: ReadonlySet<number>;
  onSelect: (ids: number[], checked: boolean) => void;
  onRestore: () => void;
  busy: boolean;
}

/** D-039: what is in the Recycle Bin, filterable per drive, with checkboxes to restore. */
export function BinList({ listing, selected, onSelect, onRestore, busy }: Props) {
  const i18n = useI18n();
  const { t, fmt } = i18n;
  const [drive, setDrive] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "deleted",
    desc: true,
  });

  const needle = query.trim().toLowerCase();
  const visible = useMemo(() => {
    const rows = listing.items.filter(
      (i) =>
        (drive === null || i.drive === drive) &&
        (!needle || i.originalPath.toLowerCase().includes(needle)),
    );
    const cmp = (a: BinItem, b: BinItem) =>
      sort.key === "name"
        ? a.name.localeCompare(b.name)
        : sort.key === "size"
          ? a.size - b.size
          : a.deleted - b.deleted;
    return rows.sort((a, b) => (sort.desc ? -cmp(a, b) : cmp(a, b)));
  }, [listing.items, drive, needle, sort]);

  const sizes = useMemo(
    () => new Map(listing.items.map((i) => [i.itemId, i.size])),
    [listing.items],
  );
  const selectedBytes = [...selected].reduce((sum, id) => sum + (sizes.get(id) ?? 0), 0);
  const tooMany = selected.size > listing.maxItems;
  const shownIds = visible.map((i) => i.itemId);
  const manyDrives = listing.drives.length > 1;
  const grid = `${GRID} ${manyDrives ? COLS_DRIVES : COLS_ONE_DRIVE}`;
  const shownSelected = shownIds.filter((id) => selected.has(id)).length;

  function clickSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== "name" }));
  }
  const arrow = (key: SortKey) => (sort.key === key ? (sort.desc ? " ▼" : " ▲") : "");
  const ariaSort = (key: SortKey) =>
    sort.key === key ? (sort.desc ? "descending" : "ascending") : undefined;

  const header = (
    <div
      role="row"
      className={`${grid} h-9 border-b-2 border-line bg-sunken text-xs font-bold uppercase tracking-wide`}
    >
      <div role="columnheader">
        <Checkbox
          checked={shownIds.length > 0 && shownSelected === shownIds.length}
          indeterminate={shownSelected > 0 && shownSelected < shownIds.length}
          onChange={(c) => onSelect(shownIds, c)}
          label={t.recycleBin.selectAll}
        />
      </div>
      <div role="columnheader" aria-sort={ariaSort("name")}>
        <button type="button" onClick={() => clickSort("name")} className="uppercase">
          {t.recycleBin.colName} / {t.recycleBin.colLocation}
          {arrow("name")}
        </button>
      </div>
      {manyDrives && <div role="columnheader">{t.recycleBin.colDrive}</div>}
      <div role="columnheader" aria-sort={ariaSort("size")} className="text-right">
        <button type="button" onClick={() => clickSort("size")} className="uppercase">
          {t.recycleBin.colSize}
          {arrow("size")}
        </button>
      </div>
      <div role="columnheader" aria-sort={ariaSort("deleted")}>
        <button type="button" onClick={() => clickSort("deleted")} className="uppercase">
          {t.recycleBin.colDeleted}
          {arrow("deleted")}
        </button>
      </div>
    </div>
  );

  return (
    <section className="space-y-4" aria-labelledby="bin-list">
      <h2 id="bin-list" className={SECTION_TITLE}>
        {t.recycleBin.listTitle}
      </h2>

      {/* Per-drive filter; only useful with more than one drive. */}
      {listing.drives.length > 1 && (
        <div role="group" aria-label={t.recycleBin.drivesLabel} className="flex flex-wrap gap-2">
          {[null, ...listing.drives.map((d) => d.drive)].map((d) => {
            const info = listing.drives.find((x) => x.drive === d);
            const on = drive === d;
            return (
              <button
                key={d ?? "all"}
                type="button"
                aria-pressed={on}
                onClick={() => setDrive(d)}
                className={`rounded-control border-2 border-line px-3 py-1 text-sm font-bold shadow-hard-sm ${
                  on ? "bg-primary text-on-accent" : "bg-surface hover:bg-sunken"
                }`}
              >
                {d ?? t.recycleBin.allDrives}
                {info && (
                  <span className="ml-2 font-mono text-xs font-normal">
                    {fmt.bytes(info.size)} · {fmt.count(info.itemCount)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.recycleBin.search}
        aria-label={t.recycleBin.search}
        className="w-full"
      />

      {listing.unreadableCount > 0 && (
        <p className="text-sm text-muted">
          {t.recycleBin.unreadable(fmt.count(listing.unreadableCount))}
        </p>
      )}

      <Card className="flex flex-col overflow-hidden">
        {visible.length === 0 ? (
          <>
            {header}
            <EmptyState
              text={listing.items.length === 0 ? t.recycleBin.isEmpty : t.recycleBin.noMatch}
            />
          </>
        ) : (
          <VirtualList
            key={`${drive}/${needle}/${sort.key}/${sort.desc}`}
            className="max-h-[28rem]"
            count={visible.length}
            rowHeight={ROW_HEIGHT}
            header={header}
            renderRow={(i) => {
              const item = visible[i];
              const folder = item.originalPath.slice(0, -item.name.length).replace(/[\\/]$/, "");
              return (
                <label
                  className={`${grid} h-full cursor-pointer border-b border-line/15 text-sm hover:bg-primary-soft`}
                >
                  <Checkbox
                    checked={selected.has(item.itemId)}
                    onChange={(c) => onSelect([item.itemId], c)}
                    label={t.recycleBin.selectItem(item.name)}
                  />
                  <span className="flex min-w-0 items-center gap-2">
                    {item.isDir ? (
                      <FolderIcon className="size-4 shrink-0 fill-primary" />
                    ) : (
                      <FileIcon className="size-4 shrink-0 text-muted" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-medium" title={item.name}>
                        {item.name}
                      </span>
                      <span
                        className="block truncate font-mono text-xs text-muted"
                        title={item.originalPath}
                        dir="rtl"
                      >
                        <bdi>{folder}</bdi>
                      </span>
                    </span>
                  </span>
                  {manyDrives && <span className="font-mono text-xs">{item.drive}</span>}
                  <span className="text-right font-mono text-xs font-bold">
                    {fmt.bytes(item.size)}
                  </span>
                  <span className="text-xs text-muted">{fmt.date(item.deleted)}</span>
                </label>
              );
            }}
          />
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 text-sm">
          {t.recycleBin.selected}{" "}
          <span className="font-mono font-bold">
            {countOf(i18n, selected.size, t.units.items)} · {fmt.bytes(selectedBytes)}
          </span>
          {tooMany && (
            <span className="ml-2 font-bold text-danger-ink">
              {t.cleaner.tooMany(fmt.count(listing.maxItems))}
            </span>
          )}
        </div>
        <Button
          variant="primary"
          icon={<UndoIcon />}
          disabled={selected.size === 0 || tooMany || busy}
          onClick={onRestore}
        >
          {t.recycleBin.restore}
        </Button>
      </div>
    </section>
  );
}
