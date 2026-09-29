import { useCallback, useEffect, useState } from "react";

export type AsyncState<T> =
  { status: "loading" } | { status: "done"; data: T } | { status: "error"; error: unknown };

type Stored<T> = { fn: () => Promise<T>; attempt: number; state: AsyncState<T> };

/**
 * Runs `fn` and tracks its result. Re-runs whenever `fn` changes identity, so wrap it in
 * `useCallback` with the inputs as dependencies. Results of an outdated `fn` are dropped.
 * `retry` runs it again (for a "Try again" button).
 */
export function useAsync<T>(fn: () => Promise<T>): AsyncState<T> & { retry: () => void } {
  const [stored, setStored] = useState<Stored<T> | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    fn().then(
      (data) => alive && setStored({ fn, attempt, state: { status: "done", data } }),
      (error: unknown) => alive && setStored({ fn, attempt, state: { status: "error", error } }),
    );
    return () => {
      alive = false;
    };
  }, [fn, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  const current = stored?.fn === fn && stored.attempt === attempt;
  return { ...(current ? stored.state : { status: "loading" }), retry };
}
