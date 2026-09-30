import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const DURATION_MS = 700;

/** Cubic ease-out: fast at first, settles on the final value. */
const ease = (x: number) => 1 - (1 - x) ** 3;

/**
 * Shows `value` counting up from 0 (or from the previous value) when it first appears.
 * Plain requestAnimationFrame: one number, no need for the motion animation engine.
 * Reduced motion shows the final value right away.
 */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (reduce) {
      from.current = value;
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = requestAnimationFrame(function step(now) {
      const x = Math.min(1, (now - start) / DURATION_MS);
      const current = origin + (value - origin) * ease(x);
      from.current = current;
      setShown(current);
      if (x < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, reduce]);

  return <>{format(reduce ? value : shown)}</>;
}
