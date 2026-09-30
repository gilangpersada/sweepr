import { m } from "motion/react";
import { useState } from "react";
import { DriveCard } from "../components/DriveCard";
import { BroomIcon, ChartIcon, FolderIcon, RefreshIcon } from "../components/icons";
import { ProgressBanner } from "../components/ProgressBanner";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { SECTION_TITLE } from "../components/ui/styles";
import type { AsyncState } from "../hooks/useAsync";
import type { ScanState } from "../hooks/useScan";
import { pickFolder, type DriveInfo, type ScanFinishedEvent } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { countOf, useI18n } from "../lib/i18n";

interface Props {
  drives: AsyncState<DriveInfo[]> & { retry: () => void };
  scan: ScanState;
  /** Last finished scan, if any. */
  result: ScanFinishedEvent | null;
  onScan: (path: string) => void;
  onCancel: () => void;
  onOpenResult: () => void;
  onOpenCleaner: () => void;
}

export function Home({
  drives,
  scan,
  result,
  onScan,
  onCancel,
  onOpenResult,
  onOpenCleaner,
}: Props) {
  const i18n = useI18n();
  const { t, fmt } = i18n;
  const [pickError, setPickError] = useState<string | null>(null);
  const scanning = scan.status === "scanning";

  async function chooseFolder() {
    setPickError(null);
    try {
      const path = await pickFolder();
      if (path) onScan(path);
    } catch (e) {
      setPickError(errorMessage(t, e));
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl space-y-8 p-8">
        <header>
          <h1 className="text-3xl font-bold">{t.nav.home}</h1>
          <p className="mt-1 text-muted">{t.home.tagline}</p>
        </header>

        {scan.status === "scanning" && (
          <ProgressBanner path={scan.path} progress={scan.progress} onCancel={onCancel} />
        )}
        {scan.status === "cancelled" && (
          <Card shadow="sm" role="status" className="p-3 text-sm font-medium">
            {t.home.scanCancelled}
          </Card>
        )}
        {scan.status === "failed" && (
          <ErrorState message={t.home.scanFailed(errorMessage(t, scan.error))} />
        )}
        {result && (
          <Card tone="success" className="flex flex-wrap items-center gap-4 p-4">
            <ChartIcon className="size-6 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{t.home.lastResult}</div>
              <div className="truncate font-mono text-sm" title={result.rootPath}>
                {result.rootPath} · {fmt.bytes(result.totalBytes)} ·{" "}
                {countOf(i18n, result.totalFiles, t.units.files)}
              </div>
            </div>
            <Button variant="primary" onClick={onOpenResult}>
              {t.home.openResult}
            </Button>
          </Card>
        )}

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className={SECTION_TITLE}>{t.home.drives}</h2>
            <Button
              size="sm"
              variant="ghost"
              icon={<RefreshIcon />}
              disabled={drives.status === "loading"}
              onClick={drives.retry}
            >
              {t.common.refresh}
            </Button>
          </div>
          {drives.status === "loading" && <LoadingState text={t.home.loadingDrives} />}
          {drives.status === "error" && (
            <ErrorState message={errorMessage(t, drives.error)} onRetry={drives.retry} />
          )}
          {drives.status === "done" && drives.data.length === 0 && (
            <EmptyState text={t.home.noDrives} />
          )}
          {drives.status === "done" && drives.data.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {drives.data.map((d, i) => (
                <m.div
                  key={d.mountPoint}
                  className="flex"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.25, ease: "easeOut" }}
                >
                  <DriveCard drive={d} disabled={scanning} onScan={onScan} />
                </m.div>
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-5 md:grid-cols-2">
          <Card className="space-y-3 p-5">
            <h2 className={SECTION_TITLE}>{t.home.folder}</h2>
            <Button
              variant="primary"
              icon={<FolderIcon className="size-5" />}
              disabled={scanning}
              onClick={() => void chooseFolder()}
            >
              {t.home.chooseFolder}
            </Button>
            {pickError && <ErrorState message={pickError} />}
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className={SECTION_TITLE}>{t.home.cleaner}</h2>
            <p className="text-sm text-muted">{t.home.cleanerIntro}</p>
            <Button icon={<BroomIcon className="size-5" />} onClick={onOpenCleaner}>
              {t.home.openCleaner}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
