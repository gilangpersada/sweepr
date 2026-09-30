import { m } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import type { Page } from "../components/AppShell";
import { AlertIcon, BroomIcon, ChartIcon, DriveIcon, TrashIcon } from "../components/icons";
import { Spinner } from "../components/states";
import { Button } from "../components/ui/Button";
import { Card, type Tone } from "../components/ui/Card";
import { ProgressBar } from "../components/ui/ProgressBar";
import { SECTION_TITLE } from "../components/ui/styles";
import type { AsyncState } from "../hooks/useAsync";
import type { ScanState } from "../hooks/useScan";
import {
  estimateCleanup,
  getRecycleBinInfo,
  type CleanupEstimate,
  type DriveInfo,
  type RecycleBinInfo,
  type ScanFinishedEvent,
} from "../lib/api";
import { countOf, useI18n } from "../lib/i18n";

interface Props {
  drives: AsyncState<DriveInfo[]>;
  scan: ScanState;
  /** Last finished scan and when it finished (unix ms). */
  result: ScanFinishedEvent | null;
  finishedAt: number | null;
  /** Shown right now: numbers are refreshed on every visit. */
  active: boolean;
  onNavigate: (page: Page) => void;
}

/** "Unknown" and "failed" both show as a dash; Home is an overview, not an error screen. */
type Loadable<T> = T | "loading" | null;

/** Overview and quick actions (D-038): the state of the disk, then the four steps in order. */
export function Home({ drives, scan, result, finishedAt, active, onNavigate }: Props) {
  const i18n = useI18n();
  const { t, fmt } = i18n;
  const [bin, setBin] = useState<Loadable<RecycleBinInfo>>("loading");
  const [estimate, setEstimate] = useState<Loadable<CleanupEstimate>>("loading");

  // Refresh on each visit: cleaning or emptying elsewhere changes both numbers. The
  // estimate walks the cleaner's folders (read-only) in the background; the page never waits.
  useEffect(() => {
    if (!active) return;
    let alive = true;
    getRecycleBinInfo().then(
      (info) => alive && setBin(info),
      () => alive && setBin(null),
    );
    estimateCleanup().then(
      (est) => alive && setEstimate(est),
      () => alive && setEstimate(null),
    );
    return () => {
      alive = false;
    };
  }, [active]);

  const fullest =
    drives.status === "done" && drives.data.length > 0
      ? drives.data.reduce((a, b) => (usedShare(b) > usedShare(a) ? b : a))
      : null;
  const binInfo = bin === "loading" ? null : bin;
  const binHasItems = binInfo !== null && binInfo.itemCount > 0;

  let estimateText: ReactNode = null;
  if (estimate === "loading") {
    estimateText = (
      <span className="flex items-center gap-2 text-muted">
        <Spinner className="size-3.5" />
        {t.home.estimating}
      </span>
    );
  } else if (estimate && estimate.totalBytes > 0) {
    estimateText = (
      <span className="font-bold">{t.home.estimate(fmt.bytes(estimate.totalBytes))}</span>
    );
  } else if (estimate) {
    estimateText = <span className="text-muted">{t.home.estimateNone}</span>;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl space-y-8 p-8">
        <header>
          <h1 className="text-3xl font-bold">{t.nav.home}</h1>
          <p className="mt-1 text-muted">{t.home.tagline}</p>
        </header>

        <section className="space-y-4" aria-labelledby="home-now">
          <h2 id="home-now" className={SECTION_TITLE}>
            {t.home.now}
          </h2>
          <div className="grid gap-5 md:grid-cols-3">
            <Card className="space-y-3 p-4">
              <div className={SECTION_TITLE}>{t.home.fullestDrive}</div>
              {fullest ? (
                <>
                  <div className="flex items-center gap-2 text-lg font-bold">
                    <DriveIcon className="size-5 shrink-0" />
                    <span className="truncate">{driveTitle(fullest)}</span>
                  </div>
                  <ProgressBar
                    value={usedShare(fullest) * 100}
                    tone={usedShare(fullest) >= 0.9 ? "danger" : "primary"}
                    label={t.drive.usedLabel(driveTitle(fullest))}
                    className="h-3"
                  />
                  <div className="font-mono text-xs">
                    {t.drive.free(fmt.bytes(fullest.availableBytes), fmt.bytes(fullest.totalBytes))}
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted">
                  {drives.status === "loading" ? t.common.loading : t.home.noDrives}
                </div>
              )}
            </Card>

            <Card tone={binHasItems ? "danger" : "neutral"} className="space-y-2 p-4">
              <div className={SECTION_TITLE}>{t.home.binTitle}</div>
              <div className="font-mono text-2xl font-bold">
                {binInfo ? fmt.bytes(binInfo.sizeBytes) : "—"}
              </div>
              <div className="text-sm">
                {binInfo === null
                  ? ""
                  : binHasItems
                    ? t.home.binTaking(countOf(i18n, binInfo.itemCount, t.units.items))
                    : t.home.binEmpty}
              </div>
            </Card>

            <Card className="min-w-0 space-y-2 p-4">
              <div className={SECTION_TITLE}>{t.home.lastScan}</div>
              {scan.status === "scanning" ? (
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Spinner />
                  {t.home.scanningNow}
                </div>
              ) : result ? (
                <>
                  <div className="truncate text-lg font-bold" title={result.rootPath}>
                    {result.rootPath}
                  </div>
                  <div className="font-mono text-xs">
                    {fmt.bytes(result.totalBytes)} ·{" "}
                    {countOf(i18n, result.totalFiles, t.units.files)}
                  </div>
                  {finishedAt !== null && (
                    <div className="text-xs text-muted">{fmt.ago(finishedAt)}</div>
                  )}
                </>
              ) : (
                <div className="text-sm text-muted">{t.home.noScan}</div>
              )}
            </Card>
          </div>
        </section>

        <section className="space-y-4" aria-labelledby="home-next">
          <h2 id="home-next" className={SECTION_TITLE}>
            {t.home.whatNext}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Step
              index={0}
              title={t.home.step1Title}
              text={t.home.step1Text}
              icon={<DriveIcon className="size-5" />}
              button={t.home.step1Button}
              onClick={() => onNavigate("scan")}
              primary
            />
            <Step
              index={1}
              title={t.home.step2Title}
              text={result ? t.home.step2Text : t.home.step2Disabled}
              icon={<ChartIcon className="size-5" />}
              button={t.home.step2Button}
              disabled={!result}
              onClick={() => onNavigate("results")}
            />
            <Step
              index={2}
              title={t.home.step3Title}
              text={t.home.step3Text}
              extra={estimateText}
              icon={<BroomIcon className="size-5" />}
              button={t.home.step3Button}
              onClick={() => onNavigate("cleaner")}
            />
            <Step
              index={3}
              title={t.home.step4Title}
              text={
                binHasItems ? t.home.step4Text(fmt.bytes(binInfo.sizeBytes)) : t.home.step4Empty
              }
              icon={<TrashIcon className="size-5" />}
              button={t.home.step4Button}
              tone={binHasItems ? "danger" : "neutral"}
              onClick={() => onNavigate("recycleBin")}
            />
          </div>
        </section>

        <p className="flex items-start gap-2 text-sm text-muted">
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          {t.home.safety}
        </p>
      </div>
    </div>
  );
}

function Step({
  index,
  title,
  text,
  extra,
  icon,
  button,
  onClick,
  disabled = false,
  primary = false,
  tone = "neutral",
}: {
  index: number;
  title: string;
  text: string;
  extra?: ReactNode;
  icon: ReactNode;
  button: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  tone?: Tone;
}) {
  return (
    <m.div
      className="flex"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.25, ease: "easeOut" }}
    >
      <Card tone={tone} className="flex w-full flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-control border-2 border-line bg-primary font-mono font-bold text-on-accent">
            {index + 1}
          </span>
          <h3 className="text-lg font-bold">{title}</h3>
        </div>
        <p className="text-sm text-muted">{text}</p>
        {extra && <div className="text-sm">{extra}</div>}
        <Button
          variant={primary ? "primary" : "secondary"}
          icon={icon}
          disabled={disabled}
          onClick={onClick}
          className="mt-auto self-start"
        >
          {button}
        </Button>
      </Card>
    </m.div>
  );
}

const usedShare = (d: DriveInfo) => (d.totalBytes > 0 ? d.usedBytes / d.totalBytes : 0);
const driveTitle = (d: DriveInfo) => (d.name ? `${d.name} (${d.mountPoint})` : d.mountPoint);
