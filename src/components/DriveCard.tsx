import type { DriveInfo } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { DriveIcon } from "./icons";
import { PRESSABLE } from "./ui/Button";
import { ProgressBar } from "./ui/ProgressBar";

interface Props {
  drive: DriveInfo;
  disabled: boolean;
  onScan: (path: string) => void;
}

export function DriveCard({ drive, disabled, onScan }: Props) {
  const { t, fmt } = useI18n();
  const usedPct = drive.totalBytes > 0 ? (drive.usedBytes / drive.totalBytes) * 100 : 0;
  const title = drive.name ? `${drive.name} (${drive.mountPoint})` : drive.mountPoint;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onScan(drive.mountPoint)}
      className={`flex w-full flex-col gap-3 rounded-card border-2 border-line bg-surface p-4 text-left shadow-hard disabled:cursor-not-allowed disabled:opacity-50 ${PRESSABLE}`}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-control border-2 border-line bg-info text-on-accent">
          <DriveIcon className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-lg font-bold">{title}</div>
          <div className="text-xs font-medium text-muted">
            {drive.fileSystem}
            {drive.isRemovable && ` · ${t.drive.removable}`}
          </div>
        </div>
      </div>
      {/* Nearly full drives get the warning color. */}
      <ProgressBar
        value={usedPct}
        tone={usedPct >= 90 ? "danger" : "primary"}
        label={t.drive.usedLabel(title)}
      />
      <div className="flex justify-between gap-2 font-mono text-xs">
        <span>{t.drive.used(fmt.bytes(drive.usedBytes))}</span>
        <span className="text-muted">
          {t.drive.free(fmt.bytes(drive.availableBytes), fmt.bytes(drive.totalBytes))}
        </span>
      </div>
    </button>
  );
}
