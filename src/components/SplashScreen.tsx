import { m, useReducedMotion, type Variants } from "motion/react";
import { useLayoutEffect } from "react";
import { useI18n } from "../lib/i18n";
import { ErrorState } from "./states";

// Same letters, sizes and colors as the static splash in index.html (D-036).
const LETTERS = ["S", "W", "E", "E", "P", "R"];
const TILE_COLORS = ["bg-primary", "bg-danger", "bg-info", "bg-success", "bg-primary", "bg-danger"];
/** Track width = 6 tiles of 56 px + 5 gaps of 10 px, like the static splash. */
const TRACK = 386;
const BROOM = 44;
const SWEEP_S = 1.6;
/** Dust positions along the track, as a fraction of the broom's travel. */
const DUST = [0.18, 0.32, 0.47, 0.6, 0.74, 0.88];

const word: Variants = {
  shown: { transition: { staggerChildren: 0.07 } },
  gone: { transition: { staggerChildren: 0.03 } },
};
const tile: Variants = {
  hidden: { y: -90, opacity: 0 },
  shown: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 520, damping: 22 } },
  gone: { y: 90, opacity: 0, transition: { duration: 0.2, ease: "easeIn" } },
};

interface Props {
  /** Loading the first data failed: replaces the sweeping bar with the error and "Try again". */
  error: string | null;
  onRetry: () => void;
}

/**
 * Loading screen (D-036): letter tiles drop in one by one, then a yellow broom sweeps dust
 * across until the first data is there. Leaving: tiles fall away and the screen fades.
 * Reduced motion: static wordmark and fades only.
 */
export function SplashScreen({ error, onRetry }: Props) {
  const { t } = useI18n();
  const reduce = useReducedMotion();

  // React has taken over: remove the static splash from index.html.
  useLayoutEffect(() => {
    document.getElementById("splash")?.remove();
  }, []);

  return (
    <m.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-canvas text-ink"
      initial="hidden"
      animate="shown"
      exit="gone"
      variants={{
        gone: { opacity: 0, transition: { delay: 0.25, duration: 0.2 } },
      }}
    >
      <m.div className="flex gap-2.5" variants={word} aria-hidden="true">
        {LETTERS.map((ch, i) => (
          <m.span
            key={i}
            variants={tile}
            className={`flex size-14 items-center justify-center rounded-card border-[3px] border-line text-[32px] font-bold text-on-accent shadow-hard ${TILE_COLORS[i]}`}
          >
            {ch}
          </m.span>
        ))}
      </m.div>

      {error ? (
        <div className="w-full max-w-md px-6">
          <ErrorState message={error} onRetry={onRetry} />
        </div>
      ) : (
        <div role="status" className="flex flex-col items-center gap-3">
          <div className="relative h-7" style={{ width: TRACK }} aria-hidden="true">
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-line" />
            {DUST.map((f, i) => (
              <m.span
                key={i}
                className={`absolute bottom-1.5 border-2 border-line bg-sunken ${
                  i % 2 ? "size-2.5 rounded-full" : "size-2 rounded-[2px]"
                }`}
                style={{ left: BROOM + f * (TRACK - BROOM * 1.5) }}
                animate={reduce ? undefined : { opacity: [1, 1, 0, 0], x: [0, 0, 14, 14] }}
                transition={{
                  duration: SWEEP_S,
                  times: [0, f, Math.min(1, f + 0.06), 1],
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            ))}
            <m.span
              className="absolute bottom-1 h-5 rounded-sm border-2 border-line bg-primary shadow-hard-sm"
              style={{ width: BROOM }}
              animate={reduce ? undefined : { x: [0, TRACK - BROOM] }}
              transition={{ duration: SWEEP_S, repeat: Infinity, ease: "linear" }}
            />
          </div>
          <span className="text-sm font-medium text-muted">{t.splash.loading}</span>
        </div>
      )}
    </m.div>
  );
}
