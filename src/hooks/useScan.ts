import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelScan,
  onScanCancelled,
  onScanFailed,
  onScanFinished,
  onScanProgress,
  startScan,
  type ScanError,
  type ScanFinishedEvent,
  type ScanId,
  type ScanProgressEvent,
} from "../lib/api";

export type ScanState =
  | { status: "idle" }
  | { status: "scanning"; scanId: ScanId | null; progress: ScanProgressEvent | null }
  | { status: "finished"; result: ScanFinishedEvent }
  | { status: "cancelled" }
  | { status: "failed"; error: ScanError };

type FinalEvent =
  | { kind: "finished"; e: ScanFinishedEvent }
  | { kind: "cancelled"; scanId: ScanId }
  | { kind: "failed"; scanId: ScanId; error: ScanError };

function toState(f: FinalEvent): ScanState {
  switch (f.kind) {
    case "finished":
      return { status: "finished", result: f.e };
    case "cancelled":
      return { status: "cancelled" };
    case "failed":
      return { status: "failed", error: f.error };
  }
}

/** Runs one scan at a time and tracks its progress/outcome from backend events. */
export function useScan() {
  const [state, setState] = useState<ScanState>({ status: "idle" });
  const activeId = useRef<ScanId | null>(null);
  // A small scan can finish before `startScan` resolves; keep its final event until then.
  const earlyFinal = useRef(new Map<ScanId, FinalEvent>());

  useEffect(() => {
    const handleFinal = (f: FinalEvent, scanId: ScanId) => {
      if (activeId.current === scanId) {
        activeId.current = null;
        setState(toState(f));
      } else {
        earlyFinal.current.set(scanId, f);
      }
    };
    const subs = [
      onScanProgress((e) => {
        if (activeId.current === e.scanId) {
          setState({ status: "scanning", scanId: e.scanId, progress: e });
        }
      }),
      onScanFinished((e) => handleFinal({ kind: "finished", e }, e.scanId)),
      onScanCancelled((e) => handleFinal({ kind: "cancelled", scanId: e.scanId }, e.scanId)),
      onScanFailed((e) =>
        handleFinal({ kind: "failed", scanId: e.scanId, error: e.error }, e.scanId),
      ),
    ];
    return () => {
      subs.forEach((p) => void p.then((unlisten) => unlisten()));
    };
  }, []);

  const start = useCallback(async (path: string) => {
    activeId.current = null;
    setState({ status: "scanning", scanId: null, progress: null });
    const scanId = await startScan(path);
    const early = earlyFinal.current.get(scanId);
    earlyFinal.current.clear();
    if (early) {
      setState(toState(early));
    } else {
      activeId.current = scanId;
      setState((s) => (s.status === "scanning" ? { ...s, scanId } : s));
    }
  }, []);

  const cancel = useCallback(() => {
    if (activeId.current !== null) void cancelScan(activeId.current);
  }, []);

  return { state, start, cancel };
}
