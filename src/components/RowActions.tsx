import { getNodePath, revealInExplorer, type ScanId } from "../lib/api";
import { copyText } from "../lib/clipboard";
import { errorMessage } from "../lib/errors";
import { CopyIcon, RevealIcon } from "./icons";

interface Props {
  scanId: ScanId;
  nodeId: number;
  /** Known path (largest files list); otherwise it is fetched for "copy path". */
  path?: string;
  /** Shows a short message to the user (toast). */
  notify: (message: string) => void;
}

const BUTTON =
  "rounded p-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-100";

export function RowActions({ scanId, nodeId, path, notify }: Props) {
  async function copyPath() {
    try {
      await copyText(path ?? (await getNodePath(scanId, nodeId)));
      notify("Path disalin");
    } catch (e) {
      notify(`Gagal menyalin path: ${errorMessage(e)}`);
    }
  }

  function reveal() {
    revealInExplorer(scanId, nodeId).catch((e: unknown) => notify(errorMessage(e)));
  }

  return (
    <div className="flex justify-end gap-0.5">
      <button type="button" onClick={reveal} title="Buka di Explorer" className={BUTTON}>
        <RevealIcon />
        <span className="sr-only">Buka di Explorer</span>
      </button>
      <button type="button" onClick={() => void copyPath()} title="Salin path" className={BUTTON}>
        <CopyIcon />
        <span className="sr-only">Salin path</span>
      </button>
    </div>
  );
}
