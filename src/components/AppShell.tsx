import { AnimatePresence, m } from "motion/react";
import type { ReactNode } from "react";
import logo from "../assets/logo.png";
import type { ScanState } from "../hooks/useScan";
import { useI18n } from "../lib/i18n";
import { BroomIcon, ChartIcon, DriveIcon, HomeIcon, SettingsIcon, TrashIcon } from "./icons";
import { Button } from "./ui/Button";
import { ProgressBar } from "./ui/ProgressBar";

export type Page = "home" | "scan" | "results" | "cleaner" | "recycleBin" | "settings";

const MENU: { page: Page; icon: (p: { className?: string }) => ReactNode }[] = [
  { page: "home", icon: HomeIcon },
  { page: "scan", icon: DriveIcon },
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

/** Always-wide sidebar menu (icon, name and a short hint of what is inside; D-033, D-038)
 * and the content area. */
export function AppShell({ page, onNavigate, hasResult, scan, onCancel, children }: Props) {
  const i18n = useI18n();
  const { t, fmt } = i18n;

  return (
    <div className="flex h-screen bg-canvas text-ink">
      <aside className="flex w-56 shrink-0 flex-col gap-6 overflow-y-auto border-r-[3px] border-line bg-surface p-4">
        {/* Brand: the app icon (fox with a broom) and the name. */}
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-control border-2 border-line bg-primary-soft shadow-hard-sm">
            <img src={logo} alt="" className="size-9" draggable={false} />
          </span>
          <span className="text-2xl font-bold tracking-tight">Sweepr</span>
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
                onClick={() => onNavigate(target)}
                className={`flex items-center gap-3 rounded-control border-2 px-3 py-1.5 text-left transition-[translate,box-shadow] duration-100 disabled:cursor-not-allowed disabled:opacity-45 ${
                  selected
                    ? "border-line bg-primary text-on-accent shadow-hard-sm"
                    : "border-transparent enabled:hover:border-line enabled:hover:bg-sunken"
                }`}
              >
                <Icon className="size-5 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-bold">{t.nav[target]}</span>
                  <span
                    className={`block text-xs leading-snug ${selected ? "text-on-accent" : "text-muted"}`}
                  >
                    {disabled ? t.nav.resultsHint : t.nav.hints[target]}
                  </span>
                </span>
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

      {/* Clips the page slide-in so it never widens the window (no scrollbar flash). */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
