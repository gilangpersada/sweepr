import { useCallback } from "react";
import { useChildren } from "../hooks/useChildren";
import type { NodeView, ScanId, SortBy, SortOrder } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { useI18n } from "../lib/i18n";
import { FileIcon, FolderIcon } from "./icons";
import { RowActions } from "./RowActions";
import { EmptyState, ErrorState, LoadingState } from "./states";
import { VirtualList } from "./VirtualList";

export interface Sort {
  sortBy: SortBy;
  order: SortOrder;
}

interface Props {
  scanId: ScanId;
  nodeId: number;
  sort: Sort;
  onSortChange: (sort: Sort) => void;
  /** Enter a sub folder. */
  onOpen: (node: NodeView) => void;
  notify: (message: string) => void;
}

const ROW_HEIGHT = 36;
// Shared by header and rows so the columns line up. The parent is a CSS container: when it is
// narrow (window near its 800 px minimum, next to the sidebar) the file count column is dropped
// and the percent column shows only the number.
const GRID =
  "grid grid-cols-[minmax(0,1fr)_6.5rem_10rem_6rem_7.5rem_4.5rem] @max-2xl:grid-cols-[minmax(0,1fr)_6rem_4.5rem_6.5rem_4rem] items-center gap-3 px-3";
const WIDE_ONLY = "@max-2xl:hidden";

type ColumnId = "name" | "size" | "percent" | "files" | "modified" | "actions";

const COLUMNS: { id: ColumnId; sortBy?: SortBy; align?: string }[] = [
  { id: "name", sortBy: "name" },
  { id: "size", sortBy: "size", align: "text-right" },
  { id: "percent", sortBy: "size" },
  { id: "files", sortBy: "fileCount", align: `text-right ${WIDE_ONLY}` },
  { id: "modified", sortBy: "modified" },
  { id: "actions", align: "text-right" },
];

export function FolderTable({ scanId, nodeId, sort, onSortChange, onOpen, notify }: Props) {
  const { t, fmt } = useI18n();
  const { total, rows, error, ensureRange } = useChildren(scanId, nodeId, sort.sortBy, sort.order);

  const renderRow = useCallback(
    (i: number) => {
      const node = rows[i];
      if (!node) {
        return <div className={`${GRID} h-full text-sm text-muted`}>{t.table.loadingRow}</div>;
      }
      const canOpen = node.isDir && node.hasChildren;
      return (
        <div
          className={`${GRID} h-full border-b border-line/15 text-sm hover:bg-primary-soft`}
          onDoubleClick={() => canOpen && onOpen(node)}
        >
          <div role="cell" className="flex min-w-0 items-center gap-2">
            {node.isDir ? (
              <FolderIcon className="size-4 shrink-0 fill-primary" />
            ) : (
              <FileIcon className="size-4 shrink-0 text-muted" />
            )}
            {canOpen ? (
              <button
                type="button"
                onClick={() => onOpen(node)}
                className="truncate text-left font-medium hover:underline hover:decoration-2 hover:underline-offset-2"
                title={node.name}
              >
                {node.name}
              </button>
            ) : (
              <span className="truncate" title={node.name}>
                {node.name}
              </span>
            )}
          </div>
          <div role="cell" className="text-right font-mono text-xs font-bold">
            {fmt.bytes(node.size)}
          </div>
          <div role="cell" className="flex items-center gap-2">
            <div
              className={`h-2.5 flex-1 overflow-hidden rounded-sm border border-line bg-surface ${WIDE_ONLY}`}
            >
              <div
                className="h-full bg-info"
                style={{ width: `${Math.min(100, node.percentOfParent)}%` }}
              />
            </div>
            <span className="w-12 text-right font-mono text-xs text-muted">
              {fmt.percent(node.percentOfParent)}
            </span>
          </div>
          <div role="cell" className={`text-right font-mono text-xs text-muted ${WIDE_ONLY}`}>
            {node.isDir ? fmt.count(node.fileCount) : ""}
          </div>
          <div role="cell" className="truncate text-xs text-muted">
            {fmt.date(node.modified)}
          </div>
          <div role="cell">
            <RowActions scanId={scanId} nodeId={node.id} notify={notify} />
          </div>
        </div>
      );
    },
    [rows, scanId, onOpen, notify, t, fmt],
  );

  function clickHeader(sortBy: SortBy) {
    if (sortBy === sort.sortBy) {
      onSortChange({ sortBy, order: sort.order === "asc" ? "desc" : "asc" });
    } else {
      // Names read naturally A→Z; sizes, counts and dates are most useful largest/newest first.
      onSortChange({ sortBy, order: sortBy === "name" ? "asc" : "desc" });
    }
  }

  const header = (
    <div
      role="row"
      className={`${GRID} h-9 border-b-2 border-line bg-sunken text-xs font-bold uppercase tracking-wide`}
    >
      {COLUMNS.map((col) => {
        const label = t.table[col.id];
        // "Size" and "% of folder" sort the same way; show the arrow on "Size" only.
        const active = col.sortBy === sort.sortBy && col.id !== "percent";
        const colSort = col.sortBy;
        return (
          <div
            key={col.id}
            role="columnheader"
            aria-sort={active ? (sort.order === "asc" ? "ascending" : "descending") : undefined}
            className={col.align}
          >
            {colSort ? (
              <button
                type="button"
                onClick={() => clickHeader(colSort)}
                className="uppercase hover:underline hover:decoration-2 hover:underline-offset-2"
              >
                {label}
                {active && (sort.order === "asc" ? " ▲" : " ▼")}
              </button>
            ) : (
              label
            )}
          </div>
        );
      })}
    </div>
  );

  if (error) return <ErrorState message={errorMessage(t, error)} />;
  if (total === null) {
    return (
      <div className="flex flex-1 flex-col">
        {header}
        <LoadingState />
      </div>
    );
  }
  if (total === 0) {
    return (
      <div className="flex flex-1 flex-col">
        {header}
        <EmptyState text={t.table.emptyFolder} />
      </div>
    );
  }
  return (
    <VirtualList
      key={`${nodeId}/${sort.sortBy}/${sort.order}`}
      className="min-h-0 flex-1"
      count={total}
      rowHeight={ROW_HEIGHT}
      header={header}
      renderRow={renderRow}
      onRangeChange={ensureRange}
    />
  );
}
