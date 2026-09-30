import { useCallback, useState } from "react";
import { usePagedList } from "../hooks/usePagedList";
import {
  getCategoryFiles,
  type FileView,
  type ScanId,
  type SortBy,
  type SortOrder,
} from "../lib/api";
import { categoryStyle } from "../lib/categories";
import { errorMessage } from "../lib/errors";
import { countOf, useI18n } from "../lib/i18n";
import { FileIcon } from "./icons";
import { RowActions } from "./RowActions";
import { EmptyState, ErrorState, LoadingState } from "./states";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { VirtualList } from "./VirtualList";

const ROW_HEIGHT = 48;
const GRID = "grid grid-cols-[minmax(0,1fr)_6.5rem_7.5rem_6rem] items-center gap-3 px-3";

interface Props {
  scanId: ScanId;
  nodeId: number;
  /** Category key, e.g. "video". */
  category: string;
  /** Total size and file count from the summary, for the heading. */
  size: number;
  fileCount: number;
  onBack: () => void;
  notify: (message: string) => void;
}

/** D-040: the files of one category below the current folder, loaded page by page. */
export function CategoryFiles({
  scanId,
  nodeId,
  category,
  size,
  fileCount,
  onBack,
  notify,
}: Props) {
  const i18n = useI18n();
  const { t, fmt } = i18n;
  const style = categoryStyle(t, category);
  const [sort, setSort] = useState<{ sortBy: SortBy; order: SortOrder }>({
    sortBy: "size",
    order: "desc",
  });
  const load = useCallback(
    (offset: number, limit: number) =>
      getCategoryFiles({ scanId, nodeId, category, ...sort, offset, limit }),
    [scanId, nodeId, category, sort],
  );
  const key = `${scanId}/${nodeId}/${category}/${sort.sortBy}/${sort.order}`;
  const { total, rows, error, ensureRange } = usePagedList<FileView>(key, load);

  function clickSort(sortBy: SortBy) {
    setSort((s) =>
      s.sortBy === sortBy
        ? { sortBy, order: s.order === "asc" ? "desc" : "asc" }
        : { sortBy, order: sortBy === "name" ? "asc" : "desc" },
    );
  }
  const headerCell = (sortBy: SortBy, label: string, align = "") => {
    const active = sort.sortBy === sortBy;
    return (
      <div
        role="columnheader"
        aria-sort={active ? (sort.order === "asc" ? "ascending" : "descending") : undefined}
        className={align}
      >
        <button type="button" onClick={() => clickSort(sortBy)} className="uppercase">
          {label}
          {active && (sort.order === "asc" ? " ▲" : " ▼")}
        </button>
      </div>
    );
  };

  const header = (
    <div
      role="row"
      className={`${GRID} h-9 border-b-2 border-line bg-sunken text-xs font-bold uppercase tracking-wide`}
    >
      {headerCell("name", t.table.nameAndLocation)}
      {headerCell("size", t.table.size, "text-right")}
      {headerCell("modified", t.table.modified)}
      <div role="columnheader" className="text-right">
        {t.table.actions}
      </div>
    </div>
  );

  let body;
  if (error) body = <ErrorState message={errorMessage(t, error)} />;
  else if (total === null) body = <LoadingState />;
  else if (total === 0) body = <EmptyState text={t.table.noFiles} />;
  else {
    body = (
      <VirtualList
        key={key}
        className="max-h-[32rem]"
        count={total}
        rowHeight={ROW_HEIGHT}
        header={header}
        onRangeChange={ensureRange}
        renderRow={(i) => {
          const f = rows[i];
          if (!f) {
            return <div className={`${GRID} h-full text-sm text-muted`}>{t.table.loadingRow}</div>;
          }
          return (
            <div className={`${GRID} h-full border-b border-line/15 text-sm hover:bg-primary-soft`}>
              <div role="cell" className="flex min-w-0 items-center gap-2">
                <FileIcon className="size-4 shrink-0 text-muted" />
                <div className="min-w-0">
                  <div className="truncate font-medium" title={f.name}>
                    {f.name}
                  </div>
                  <div className="truncate font-mono text-xs text-muted" title={f.path} dir="rtl">
                    <bdi>{f.path}</bdi>
                  </div>
                </div>
              </div>
              <div role="cell" className="text-right font-mono text-xs font-bold">
                {fmt.bytes(f.size)}
              </div>
              <div role="cell" className="text-xs text-muted">
                {fmt.date(f.modified)}
              </div>
              <div role="cell">
                <RowActions
                  scanId={scanId}
                  nodeId={f.id}
                  path={f.path}
                  notify={notify}
                  openable={f.openable ?? false}
                />
              </div>
            </div>
          );
        }}
      />
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="category-files">
      <div className="flex flex-wrap items-center gap-4">
        <Button size="sm" onClick={onBack}>
          {t.categories.back}
        </Button>
        <h2 id="category-files" className="flex items-center gap-2 font-bold">
          <span
            aria-hidden="true"
            className={`size-4 rounded-sm border-2 border-line ${style.color}`}
          />
          {t.categories.filesOf(style.label)}
        </h2>
        <span className="font-mono text-xs text-muted">
          {fmt.bytes(size)} · {countOf(i18n, fileCount, t.units.files)}
        </span>
      </div>
      <Card className="flex flex-col overflow-hidden">
        {total === null || total === 0 || error ? header : null}
        {body}
      </Card>
    </section>
  );
}
