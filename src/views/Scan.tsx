import { m } from "motion/react";
import { useState } from "react";
import { DriveCard } from "../components/DriveCard";
import { FolderIcon, RefreshIcon } from "../components/icons";
import { ProgressBanner } from "../components/ProgressBanner";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { SECTION_TITLE } from "../components/ui/styles";
import type { AsyncState } from "../hooks/useAsync";
import type { ScanState } from "../hooks/useScan";
import { pickFolder, type DriveInfo } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { useI18n } from "../lib/i18n";

interface Props {
  drives: AsyncState<DriveInfo[]> & { retry: () => void };
  scan: ScanState;
  onScan: (path: string) => void;
  onCancel: () => void;
}

/** The only place a scan starts (besides "Scan again" on a result, D-038). */
export function Scan({ drives, scan, onScan, onCancel }: Props) {
  const { t } = useI18n();
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
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b-[3px] border-line bg-surface px-6 py-4">
        <h1 className="text-xl font-bold">{t.scan.title}</h1>
        <p className="text-sm text-muted">{t.scan.intro}</p>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl space-y-8 p-6">
          {scan.status === "scanning" && (
            <ProgressBanner path={scan.path} progress={scan.progress} onCancel={onCancel} />
          )}
          {scan.status === "cancelled" && (
            <Card shadow="sm" role="status" className="p-3 text-sm font-medium">
              {t.scan.scanCancelled}
            </Card>
          )}
          {scan.status === "failed" && (
            <ErrorState message={t.scan.scanFailed(errorMessage(t, scan.error))} />
          )}

          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className={SECTION_TITLE}>{t.scan.drives}</h2>
                <p className="text-sm text-muted">{t.scan.driveHint}</p>
              </div>
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
            {drives.status === "loading" && <LoadingState text={t.scan.loadingDrives} />}
            {drives.status === "error" && (
              <ErrorState message={errorMessage(t, drives.error)} onRetry={drives.retry} />
            )}
            {drives.status === "done" && drives.data.length === 0 && (
              <EmptyState text={t.scan.noDrives} />
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

          <Card className="space-y-3 p-5">
            <h2 className={SECTION_TITLE}>{t.scan.folder}</h2>
            <p className="text-sm text-muted">{t.scan.folderHint}</p>
            <Button
              variant="primary"
              icon={<FolderIcon className="size-5" />}
              disabled={scanning}
              onClick={() => void chooseFolder()}
            >
              {t.scan.chooseFolder}
            </Button>
            {pickError && <ErrorState message={pickError} />}
          </Card>
        </div>
      </div>
    </div>
  );
}
