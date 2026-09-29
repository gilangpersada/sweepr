import { useEffect, useState } from "react";

export type AsyncState<T> =
  { status: "loading" } | { status: "done"; data: T } | { status: "error"; error: unknown };

type Stored<T> = { fn: () => Promise<T>; state: AsyncState<T> };

/**
 * Runs `fn` and tracks its result. Re-runs whenever `fn` changes identity, so wrap it in
 * `useCallback` with the inputs as dependencies. Results of an outdated `fn` are dropped.
 */
export function useAsync<T>(fn: () => Promise<T>): AsyncState<T> {
  const [stored, setStored] = useState<Stored<T> | null>(null);

  useEffect(() => {
    let alive = true;
    fn().then(
      (data) => alive && setStored({ fn, state: { status: "done", data } }),
      (error: unknown) => alive && setStored({ fn, state: { status: "error", error } }),
    );
    return () => {
      alive = false;
    };
  }, [fn]);

  return stored?.fn === fn ? stored.state : { status: "loading" };
}
