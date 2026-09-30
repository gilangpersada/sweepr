import type { ReactNode } from "react";
import { useI18n } from "../lib/i18n";
import { AlertIcon } from "./icons";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** Shown before the confirm label; destructive actions pass their icon (SAFETY_RULES). */
  confirmIcon?: ReactNode;
  /** "danger" for actions that delete or move the user's files. */
  tone?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal confirmation. The dialog animation never hides its content: title, text and both
 * buttons are readable and usable from the first frame (see `ui/Dialog`).
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  confirmIcon,
  tone = "primary",
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useI18n();
  const danger = tone === "danger";

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      dismissable={!busy}
      labelledBy="confirm-title"
      className="max-w-md"
    >
      <div
        className={`flex items-center gap-3 border-b-[3px] border-line px-6 py-4 ${danger ? "bg-danger" : "bg-primary"}`}
      >
        {danger && <AlertIcon className="size-6 shrink-0 text-on-accent" />}
        <h2 id="confirm-title" className="text-lg font-bold text-on-accent">
          {title}
        </h2>
      </div>
      <div className="space-y-4 p-6">
        <div className="space-y-2 text-sm">{children}</div>
        <div className="flex justify-end gap-3 pt-2">
          {/* Safe default: focus starts on Cancel, so Enter right after opening does nothing harmful. */}
          <Button onClick={onCancel} disabled={busy} data-autofocus>
            {t.common.cancel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            icon={busy ? undefined : confirmIcon}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? t.common.processing : confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
