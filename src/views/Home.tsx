import { useState } from "react";
import { DriveCard } from "../components/DriveCard";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { ProgressBanner } from "../components/ProgressBanner";
import { EmptyState, ErrorState, LoadingState } from "../components/states";
import { useAsync } from "../hooks/useAsync";
import type { ScanState } from "../hooks/useScan";
import { listDrives, pickFolder } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { useI18n } from "../lib/i18n";

interface Props {
  scan: ScanState;
  onScan: (path: string) => void;
  onCancel: () => void;
  onOpenCleaner: () => void;
}

const SECTION_TITLE = "text-sm font-semibold uppercase tracking-wide text-zinc-500";

export function Home({ scan, onScan, onCancel, onOpenCleaner }: Props) {
  const { t } = useI18n();
  const drives = useAsync(listDrives);
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
    <div className="mx-auto w-full max-w-5xl space-y-8 overflow-y-auto p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Sweepr</h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">{t.home.tagline}</p>
        </div>
        <LanguageSwitch />
      </header>

      {scan.status === "scanning" && (
        <ProgressBanner path={scan.path} progress={scan.progress} onCancel={onCancel} />
      )}
      {scan.status === "cancelled" && (
        <p role="status" className="rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
          {t.home.scanCancelled}
        </p>
      )}
      {scan.status === "failed" && (
        <ErrorState message={t.home.scanFailed(errorMessage(t, scan.error))} />
      )}

      <section className="space-y-3">
        <h2 className={SECTION_TITLE}>{t.home.drives}</h2>
        {drives.status === "loading" && <LoadingState text={t.home.loadingDrives} />}
        {drives.status === "error" && (
          <ErrorState message={errorMessage(t, drives.error)} onRetry={drives.retry} />
        )}
        {drives.status === "done" && drives.data.length === 0 && (
          <EmptyState text={t.home.noDrives} />
        )}
        {drives.status === "done" && drives.data.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {drives.data.map((d) => (
              <DriveCard key={d.mountPoint} drive={d} disabled={scanning} onScan={onScan} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className={SECTION_TITLE}>{t.home.folder}</h2>
        <button
          type="button"
          disabled={scanning}
          onClick={() => void chooseFolder()}
          className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {t.home.chooseFolder}
        </button>
        {pickError && <ErrorState message={pickError} />}
      </section>

      <section className="space-y-3">
        <h2 className={SECTION_TITLE}>{t.home.cleaner}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t.home.cleanerIntro}</p>
        <button
          type="button"
          onClick={onOpenCleaner}
          className="rounded-md border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {t.home.openCleaner}
        </button>
      </section>
    </div>
  );
}
