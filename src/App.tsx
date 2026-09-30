import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { AppShell, type Page } from "./components/AppShell";
import { PageView } from "./components/PageView";
import { SplashScreen } from "./components/SplashScreen";
import { useAsync } from "./hooks/useAsync";
import { useScan } from "./hooks/useScan";
import { listDrives } from "./lib/api";
import { errorMessage } from "./lib/errors";
import { useI18n } from "./lib/i18n";
import { Cleaner } from "./views/Cleaner";
import { Home } from "./views/Home";
import { RecycleBin } from "./views/RecycleBin";
import { ScanResult } from "./views/ScanResult";
import { Settings } from "./views/Settings";

/** The splash stays at least this long so it does not just flash (no other artificial delay). */
const SPLASH_MIN_MS = 600;

function App() {
  const { t } = useI18n();
  const { state, start, cancel } = useScan();
  const drives = useAsync(listDrives);
  const [page, setPage] = useState<Page>("home");
  // Pages stay mounted once opened, so scan position and cleaner selection survive (D-033).
  const [visited, setVisited] = useState<ReadonlySet<Page>>(() => new Set(["home"]));
  const [minElapsed, setMinElapsed] = useState(false);
  const [booted, setBooted] = useState(false);
  const [shownScanId, setShownScanId] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setMinElapsed(true), SPLASH_MIN_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const go = useCallback((next: Page) => {
    setPage(next);
    setVisited((v) => (v.has(next) ? v : new Set(v).add(next)));
  }, []);

  // Derived during render (no effect): leave the splash once, and open a new scan result when
  // it arrives while the user waits on Home. On another page (e.g. the cleaner) they are not
  // pulled away; the "Scan results" menu item becomes available instead.
  if (!booted && minElapsed && drives.status === "done") setBooted(true);
  const result = state.status === "finished" ? state.result : null;
  if (result && result.scanId !== shownScanId) {
    setShownScanId(result.scanId);
    if (page === "home") go("results");
  }

  // Starting a scan drops the previous result in the backend; show progress on Home.
  const scan = useCallback(
    (path: string) => {
      void start(path);
      go("home");
    },
    [start, go],
  );

  const current = page === "results" && !result ? "home" : page;
  const shows = (p: Page) => visited.has(p) || current === p;

  return (
    <>
      <AnimatePresence>
        {!booted && (
          <SplashScreen
            key="splash"
            error={
              drives.status === "error" ? t.splash.failed(errorMessage(t, drives.error)) : null
            }
            onRetry={drives.retry}
          />
        )}
      </AnimatePresence>

      {booted && (
        <AppShell
          page={current}
          onNavigate={go}
          hasResult={result !== null}
          scan={state}
          onCancel={cancel}
        >
          <PageView active={current === "home"}>
            <Home
              drives={drives}
              scan={state}
              result={result}
              onScan={scan}
              onCancel={cancel}
              onOpenResult={() => go("results")}
              onOpenCleaner={() => go("cleaner")}
            />
          </PageView>
          {result && shows("results") && (
            <PageView active={current === "results"}>
              {/* Keyed by scan so a rescan starts at the root with fresh state. */}
              <ScanResult
                key={result.scanId}
                result={result}
                active={current === "results"}
                onRescan={scan}
              />
            </PageView>
          )}
          {shows("cleaner") && (
            <PageView active={current === "cleaner"}>
              <Cleaner />
            </PageView>
          )}
          {shows("recycleBin") && (
            <PageView active={current === "recycleBin"}>
              <RecycleBin active={current === "recycleBin"} />
            </PageView>
          )}
          {shows("settings") && (
            <PageView active={current === "settings"}>
              <Settings />
            </PageView>
          )}
        </AppShell>
      )}
    </>
  );
}

export default App;
