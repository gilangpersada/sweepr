import { useCallback, useEffect, useRef, useState } from "react";
import { getChildren, type NodeView, type ScanId, type SortBy, type SortOrder } from "../lib/api";

/** Rows fetched per `get_children` call. A folder with 100k entries loads lazily as you scroll. */
export const PAGE_SIZE = 500;

interface Loaded {
  key: string;
  /** `null` until the first page arrives. */
  total: number | null;
  /** Sparse: pages that were not fetched yet are holes. */
  rows: (NodeView | undefined)[];
  error: unknown;
}

const empty = (key: string): Loaded => ({ key, total: null, rows: [], error: null });

/**
 * Children of one folder, sorted by the backend and fetched page by page. Call
 * `ensureRange` with the visible row range; missing pages are requested once.
 */
export function useChildren(scanId: ScanId, nodeId: number, sortBy: SortBy, order: SortOrder) {
  const key = `${scanId}/${nodeId}/${sortBy}/${order}`;
  const [data, setData] = useState<Loaded>(() => empty(key));
  // Pages already requested for the current key. Responses for an older key are dropped.
  const requested = useRef({ key: "", pages: new Set<number>() });

  const loadPage = useCallback(
    (page: number) => {
      if (requested.current.key !== key) requested.current = { key, pages: new Set() };
      if (requested.current.pages.has(page)) return;
      requested.current.pages.add(page);
      const isCurrent = () => requested.current.key === key;
      getChildren({ scanId, nodeId, sortBy, order, offset: page * PAGE_SIZE, limit: PAGE_SIZE })
        .then((res) => {
          if (!isCurrent()) return;
          setData((d) => {
            const base = d.key === key ? d : empty(key);
            const rows = base.rows.slice();
            res.items.forEach((item, i) => (rows[page * PAGE_SIZE + i] = item));
            return { ...base, total: res.total, rows };
          });
        })
        .catch((error: unknown) => {
          if (!isCurrent()) return;
          requested.current.pages.delete(page);
          setData((d) => ({ ...(d.key === key ? d : empty(key)), error }));
        });
    },
    [key, scanId, nodeId, sortBy, order],
  );

  useEffect(() => loadPage(0), [loadPage]);

  const ensureRange = useCallback(
    (start: number, end: number) => {
      if (end <= start) return;
      const last = Math.floor((end - 1) / PAGE_SIZE);
      for (let p = Math.floor(start / PAGE_SIZE); p <= last; p++) loadPage(p);
    },
    [loadPage],
  );

  const current = data.key === key ? data : empty(key);
  return { total: current.total, rows: current.rows, error: current.error, ensureRange };
}
