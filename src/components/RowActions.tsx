import { getNodePath, revealInExplorer, type ScanId } from "../lib/api";
import { copyText } from "../lib/clipboard";
import { errorMessage } from "../lib/errors";
import { useI18n } from "../lib/i18n";
import { CopyIcon, RevealIcon } from "./icons";

interface Props {
  scanId: ScanId;
  nodeId: number;
  /** Known path (largest files list); otherwise it is fetched for "copy path". */
  path?: string;
  /** Shows a short message to the user (toast). */
  notify: (message: string) => void;
}

// No shadow here: hundreds of rows would get noisy. The border shows on hover and focus.
const BUTTON =
  "rounded-sm border-2 border-transparent p-1 text-muted hover:border-line hover:bg-primary hover:text-on-accent";

export function RowActions({ scanId, nodeId, path, notify }: Props) {
  const { t } = useI18n();

  async function copyPath() {
    try {
      await copyText(path ?? (await getNodePath(scanId, nodeId)));
      notify(t.actions.copied);
    } catch (e) {
      notify(t.actions.copyFailed(errorMessage(t, e)));
    }
  }

  function reveal() {
    revealInExplorer(scanId, nodeId).catch((e: unknown) => notify(errorMessage(t, e)));
  }

  return (
    <div className="flex justify-end gap-0.5">
      <button type="button" onClick={reveal} title={t.actions.reveal} className={BUTTON}>
        <RevealIcon />
        <span className="sr-only">{t.actions.reveal}</span>
      </button>
      <button
        type="button"
        onClick={() => void copyPath()}
        title={t.actions.copyPath}
        className={BUTTON}
      >
        <CopyIcon />
        <span className="sr-only">{t.actions.copyPath}</span>
      </button>
    </div>
  );
}
