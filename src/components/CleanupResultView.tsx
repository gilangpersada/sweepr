import type { CleanupResult } from "../lib/api";
import { itemReason } from "../lib/errors";
import { formatBytes, formatCount } from "../lib/format";

interface Props {
  result: CleanupResult;
  onDone: () => void;
}

export function CleanupResultView({ result, onDone }: Props) {
  const failed = result.items.filter((i) => i.error);
  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
        <p className="font-medium">
          {formatCount(result.trashedCount)} item ({formatBytes(result.trashedBytes)}) dipindah ke
          Recycle Bin.
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Masih bisa dipulihkan dari Recycle Bin. Kosongkan Recycle Bin untuk benar-benar
          membebaskan ruang.
        </p>
      </div>

      {failed.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium">{formatCount(failed.length)} item dilewati</h3>
          <ul className="max-h-72 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-700">
            {failed.map((i) => (
              <li key={i.itemId} className="flex gap-3 px-3 py-2">
                <span className="min-w-0 flex-1 truncate" title={i.path} dir="rtl">
                  <bdi>{i.path || `#${i.itemId}`}</bdi>
                </span>
                <span className="shrink-0 text-zinc-500" title={i.error?.message}>
                  {itemReason(i.error?.code ?? "")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={onDone}
        className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
      >
        Selesai
      </button>
    </section>
  );
}
