import type { ScanProgressEvent } from "../lib/api";
import { countOf, useI18n } from "../lib/i18n";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { ProgressBar } from "./ui/ProgressBar";

interface Props {
  path: string;
  progress: ScanProgressEvent | null;
  onCancel: () => void;
}

export function ProgressBanner({ path, progress, onCancel }: Props) {
  const i18n = useI18n();
  const { t, fmt } = i18n;
  const files = progress?.filesSeen ?? 0;
  const dirs = progress?.dirsSeen ?? 0;
  return (
    <Card tone="info" role="status" aria-live="polite" className="space-y-3 p-4">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{t.progress.scanning(path)}</div>
          <div className="font-mono text-sm">
            {countOf(i18n, files, t.units.files)} · {countOf(i18n, dirs, t.units.folders)} ·{" "}
            {fmt.bytes(progress?.bytesSeen ?? 0)}
          </div>
        </div>
        <Button onClick={onCancel}>{t.common.cancel}</Button>
      </div>
      {/* The total is unknown until the scan ends, so the bar only shows that work is going on. */}
      <ProgressBar tone="info" label={t.progress.scanning(path)} className="h-3" />
      <div
        className="truncate font-mono text-xs text-muted"
        title={progress?.currentPath}
        // Keep the end of long paths visible (the file name), not the drive letter.
        dir="rtl"
      >
        <bdi>{progress?.currentPath ?? t.progress.starting}</bdi>
      </div>
    </Card>
  );
}
