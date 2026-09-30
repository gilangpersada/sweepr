import { useCallback } from "react";
import { getChildren, type NodeView, type ScanId, type SortBy, type SortOrder } from "../lib/api";
import { usePagedList } from "./usePagedList";

/**
 * Children of one folder, sorted by the backend and fetched page by page. Call
 * `ensureRange` with the visible row range; missing pages are requested once.
 */
export function useChildren(scanId: ScanId, nodeId: number, sortBy: SortBy, order: SortOrder) {
  const load = useCallback(
    (offset: number, limit: number) =>
      getChildren({ scanId, nodeId, sortBy, order, offset, limit }),
    [scanId, nodeId, sortBy, order],
  );
  return usePagedList<NodeView>(`${scanId}/${nodeId}/${sortBy}/${order}`, load);
}
