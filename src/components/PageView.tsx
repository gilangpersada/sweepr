import { m } from "motion/react";
import type { ReactNode } from "react";

/**
 * One page of the app. Inactive pages stay mounted but hidden (D-033); becoming active fades
 * in with a short slide (≤ 250 ms). Reduced motion keeps only the fade.
 */
export function PageView({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <m.div
      className={active ? "flex min-h-0 min-w-0 flex-1 flex-col" : "hidden"}
      initial={{ opacity: 0, x: 16 }}
      animate={active ? { opacity: 1, x: 0 } : { opacity: 0, x: 16 }}
      transition={{ duration: active ? 0.22 : 0, ease: "easeOut" }}
    >
      {children}
    </m.div>
  );
}
