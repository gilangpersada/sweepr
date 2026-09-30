import { useCallback, useEffect, useRef, useState } from "react";

/** Rows fetched per call. A list with 100k entries loads lazily as you scroll. */
export const PAGE_SIZE = 500;

export interface Page<T> {
  total: number;
  items: T[];
}

interface Loaded<T> {
  key: string;
  /** `null` until the first page arrives. */
  total: number | null;
  /** Sparse: pages that were not fetched yet are holes. */
  rows: (T | undefined)[];
  error: unknown;
}

const empty = <T>(key: string): Loaded<T> => ({ key, total: null, rows: [], error: null });

/**
 * A long list fetched page by page from the backend (the whole list never crosses the IPC
 * at once). `key` identifies the list; when it changes, everything starts over and answers
 * for the old key are dropped. Call `ensureRange` with the visible row range; missing pages
 * are requested once. `load` must change identity together with `key`.
 */
export function usePagedList<T>(
  key: string,
  load: (offset: number, limit: number) => Promise<Page<T>>,
) {
  const [data, setData] = useState<Loaded<T>>(() => empty(key));
  // Pages already requested for the current key.
  const requested = useRef({ key: "", pages: new Set<number>() });

  const loadPage = useCallback(
    (page: number) => {
      if (requested.current.key !== key) requested.current = { key, pages: new Set() };
      if (requested.current.pages.has(page)) return;
      requested.current.pages.add(page);
      const isCurrent = () => requested.current.key === key;
      load(page * PAGE_SIZE, PAGE_SIZE)
        .then((res) => {
          if (!isCurrent()) return;
          setData((d) => {
            const base = d.key === key ? d : empty<T>(key);
            const rows = base.rows.slice();
            res.items.forEach((item, i) => (rows[page * PAGE_SIZE + i] = item));
            return { ...base, total: res.total, rows };
          });
        })
        .catch((error: unknown) => {
          if (!isCurrent()) return;
          requested.current.pages.delete(page);
          setData((d) => ({ ...(d.key === key ? d : empty<T>(key)), error }));
        });
    },
    [key, load],
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

  const current = data.key === key ? data : empty<T>(key);
  return { total: current.total, rows: current.rows, error: current.error, ensureRange };
}
