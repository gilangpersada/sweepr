import { useCallback } from "react";
import { useChildren } from "../hooks/useChildren";
import type { NodeView, ScanId, SortBy, SortOrder } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { formatBytes, formatCount, formatDate, formatPercent } from "../lib/format";
import { FileIcon, FolderIcon } from "./icons";
import { RowActions } from "./RowActions";
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
// Shared by header and rows so the columns line up.
const GRID =
  "grid grid-cols-[minmax(0,1fr)_6.5rem_10rem_6rem_7.5rem_4.5rem] items-center gap-3 px-3";

const COLUMNS: { label: string; sortBy?: SortBy; align?: string }[] = [
  { label: "Nama", sortBy: "name" },
  { label: "Ukuran", sortBy: "size", align: "text-right" },
  { label: "% dari folder", sortBy: "size" },
  { label: "File", sortBy: "fileCount", align: "text-right" },
  { label: "Diubah", sortBy: "modified" },
  { label: "", align: "sr-only" },
];

export function FolderTable({ scanId, nodeId, sort, onSortChange, onOpen, notify }: Props) {
  const { total, rows, error, ensureRange } = useChildren(scanId, nodeId, sort.sortBy, sort.order);

  const renderRow = useCallback(
    (i: number) => {
      const node = rows[i];
      if (!node) {
        return <div className={`${GRID} h-full text-sm text-zinc-400`}>Memuat…</div>;
      }
      const canOpen = node.isDir && node.hasChildren;
      return (
        <div
          className={`${GRID} h-full border-b border-zinc-100 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60`}
          onDoubleClick={() => canOpen && onOpen(node)}
        >
          <div role="cell" className="flex min-w-0 items-center gap-2">
            {node.isDir ? (
              <FolderIcon className="size-4 shrink-0 text-amber-500" />
            ) : (
              <FileIcon className="size-4 shrink-0 text-zinc-400" />
            )}
            {canOpen ? (
              <button
                type="button"
                onClick={() => onOpen(node)}
                className="truncate text-left hover:text-blue-600 hover:underline dark:hover:text-blue-400"
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
          <div role="cell" className="text-right tabular-nums">
            {formatBytes(node.size)}
          </div>
          <div role="cell" className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div
                className="h-full bg-blue-600"
                style={{ width: `${Math.min(100, node.percentOfParent)}%` }}
              />
            </div>
            <span className="w-12 text-right text-xs tabular-nums text-zinc-500">
              {formatPercent(node.percentOfParent)}
            </span>
          </div>
          <div role="cell" className="text-right tabular-nums text-zinc-600 dark:text-zinc-400">
            {node.isDir ? formatCount(node.fileCount) : ""}
          </div>
          <div role="cell" className="text-zinc-600 dark:text-zinc-400">
            {formatDate(node.modified)}
          </div>
          <div role="cell">
            <RowActions scanId={scanId} nodeId={node.id} notify={notify} />
          </div>
        </div>
      );
    },
    [rows, scanId, onOpen, notify],
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
      className={`${GRID} h-9 border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800`}
    >
      {COLUMNS.map((col) => {
        const active = col.sortBy === sort.sortBy && col.label !== "% dari folder";
        const colSort = col.sortBy;
        return (
          <div
            key={col.label || "actions"}
            role="columnheader"
            aria-sort={active ? (sort.order === "asc" ? "ascending" : "descending") : undefined}
            className={col.align}
          >
            {colSort ? (
              <button
                type="button"
                onClick={() => clickHeader(colSort)}
                className="hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                {col.label}
                {active && (sort.order === "asc" ? " ▲" : " ▼")}
              </button>
            ) : (
              "Aksi"
            )}
          </div>
        );
      })}
    </div>
  );

  if (error) {
    return <p className="p-4 text-sm text-red-600 dark:text-red-400">{errorMessage(error)}</p>;
  }
  if (total === 0) {
    return (
      <div className="flex flex-1 flex-col">
        {header}
        <p className="p-4 text-sm text-zinc-500">Folder ini kosong.</p>
      </div>
    );
  }
  return (
    <VirtualList
      key={`${nodeId}/${sort.sortBy}/${sort.order}`}
      className="min-h-0 flex-1"
      count={total ?? 0}
      rowHeight={ROW_HEIGHT}
      header={header}
      renderRow={renderRow}
      onRangeChange={ensureRange}
    />
  );
}
