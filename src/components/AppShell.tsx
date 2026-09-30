import { AnimatePresence, m } from "motion/react";
import type { ReactNode } from "react";
import type { ScanState } from "../hooks/useScan";
import { useI18n } from "../lib/i18n";
import { BroomIcon, ChartIcon, HomeIcon, SettingsIcon, TrashIcon } from "./icons";
import { Button } from "./ui/Button";
import { ProgressBar } from "./ui/ProgressBar";

export type Page = "home" | "results" | "cleaner" | "recycleBin" | "settings";

const MENU: { page: Page; icon: (p: { className?: string }) => ReactNode }[] = [
  { page: "home", icon: HomeIcon },
  { page: "results", icon: ChartIcon },
  { page: "cleaner", icon: BroomIcon },
  { page: "recycleBin", icon: TrashIcon },
  { page: "settings", icon: SettingsIcon },
];

interface Props {
  page: Page;
  onNavigate: (page: Page) => void;
  /** "Scan results" is disabled until a scan has finished. */
  hasResult: boolean;
  scan: ScanState;
  onCancel: () => void;
  children: ReactNode;
}

/** Always-wide sidebar menu (icon + text, D-033) and the content area. */
export function AppShell({ page, onNavigate, hasResult, scan, onCancel, children }: Props) {
  const i18n = useI18n();
  const { t, fmt } = i18n;

  return (
    <div className="flex h-screen bg-canvas text-ink">
      <aside className="flex w-52 shrink-0 flex-col gap-6 border-r-[3px] border-line bg-surface p-4">
        <div className="flex gap-1" aria-hidden="true">
          {"SWEEPR".split("").map((ch, i) => (
            <span
              key={i}
              className="flex size-6 items-center justify-center rounded-sm border-2 border-line bg-primary text-sm font-bold text-on-accent"
            >
              {ch}
            </span>
          ))}
        </div>

        <nav aria-label={t.nav.label} className="flex flex-col gap-2">
          {MENU.map(({ page: target, icon: Icon }) => {
            const selected = target === page;
            const disabled = target === "results" && !hasResult;
            return (
              <button
                key={target}
                type="button"
                disabled={disabled}
                aria-current={selected ? "page" : undefined}
                title={disabled ? t.nav.resultsHint : undefined}
                onClick={() => onNavigate(target)}
                className={`flex items-center gap-3 rounded-control border-2 px-3 py-2 text-left font-bold transition-[translate,box-shadow] duration-100 disabled:cursor-not-allowed disabled:opacity-45 ${
                  selected
                    ? "border-line bg-primary text-on-accent shadow-hard-sm"
                    : "border-transparent enabled:hover:border-line enabled:hover:bg-sunken"
                }`}
              >
                <Icon className="size-5 shrink-0" />
                {t.nav[target]}
              </button>
            );
          })}
        </nav>

        {/* A running scan stays visible from every page. */}
        <AnimatePresence>
          {scan.status === "scanning" && (
            <m.div
              key="scan"
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="mt-auto space-y-2 rounded-card border-2 border-line bg-info-soft p-3 text-sm shadow-hard-sm"
            >
              <div className="font-bold">{t.nav.scanning}</div>
              <ProgressBar tone="info" label={t.nav.scanning} className="h-3" />
              <div className="font-mono text-xs">{fmt.bytes(scan.progress?.bytesSeen ?? 0)}</div>
              <Button size="sm" className="w-full" onClick={onCancel}>
                {t.nav.cancelScan}
              </Button>
            </m.div>
          )}
        </AnimatePresence>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
