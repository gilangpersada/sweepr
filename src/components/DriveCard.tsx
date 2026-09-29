import type { DriveInfo } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { DriveIcon } from "./icons";

interface Props {
  drive: DriveInfo;
  disabled: boolean;
  onScan: (path: string) => void;
}

export function DriveCard({ drive, disabled, onScan }: Props) {
  const { t, fmt } = useI18n();
  const usedPct = drive.totalBytes > 0 ? (drive.usedBytes / drive.totalBytes) * 100 : 0;
  // Nearly full drives get a warning color.
  const barColor = usedPct >= 90 ? "bg-red-500" : "bg-blue-600";
  const title = drive.name ? `${drive.name} (${drive.mountPoint})` : drive.mountPoint;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onScan(drive.mountPoint)}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 text-left transition hover:border-blue-400 hover:bg-blue-50/50 disabled:pointer-events-none disabled:opacity-50 dark:border-zinc-700 dark:hover:border-blue-500 dark:hover:bg-zinc-800"
    >
      <div className="flex items-center gap-3">
        <DriveIcon className="size-6 shrink-0 text-zinc-500" />
        <div className="min-w-0">
          <div className="truncate font-medium">{title}</div>
          <div className="text-xs text-zinc-500">
            {drive.fileSystem}
            {drive.isRemovable && ` · ${t.drive.removable}`}
          </div>
        </div>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"
        role="progressbar"
        aria-valuenow={Math.round(usedPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t.drive.usedLabel(title)}
      >
        <div className={`h-full ${barColor}`} style={{ width: `${usedPct}%` }} />
      </div>
      <div className="flex justify-between gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <span>{t.drive.used(fmt.bytes(drive.usedBytes))}</span>
        <span>{t.drive.free(fmt.bytes(drive.availableBytes), fmt.bytes(drive.totalBytes))}</span>
      </div>
    </button>
  );
}
