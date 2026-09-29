import type { ScanProgressEvent } from "../lib/api";
import { formatBytes, formatCount } from "../lib/format";

interface Props {
  path: string;
  progress: ScanProgressEvent | null;
  onCancel: () => void;
}

export function ProgressBanner({ path, progress, onCancel }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/40"
    >
      <div className="size-5 shrink-0 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">Memindai {path}</div>
        <div className="text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
          {formatCount(progress?.filesSeen ?? 0)} file · {formatCount(progress?.dirsSeen ?? 0)}{" "}
          folder · {formatBytes(progress?.bytesSeen ?? 0)}
        </div>
        <div
          className="truncate text-xs text-zinc-500"
          title={progress?.currentPath}
          // Keep the end of long paths visible (the file name), not the drive letter.
          dir="rtl"
        >
          <bdi>{progress?.currentPath ?? "Memulai…"}</bdi>
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 rounded-md border border-red-400 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        Batal
      </button>
    </div>
  );
}
