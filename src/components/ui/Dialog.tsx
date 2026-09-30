import { AnimatePresence, m } from "motion/react";
import { useLayoutEffect, useRef, type ReactNode } from "react";

interface Props {
  open: boolean;
  /** Esc or a close button. Not called while `dismissable` is false (e.g. busy). */
  onClose: () => void;
  dismissable?: boolean;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}

/**
 * Modal on `<dialog>` (focus trap and Esc come from the browser), mounted only while open.
 *
 * Entering only slides/scales; opacity stays at 1, so the content (and a delete confirmation's
 * buttons) is readable and usable from the first frame. Leaving fades out quickly.
 * The element marked `data-autofocus` gets focus when it opens.
 */
export function Dialog(props: Props) {
  return <AnimatePresence>{props.open && <DialogBody {...props} />}</AnimatePresence>;
}

function DialogBody({ onClose, dismissable = true, labelledBy, className = "", children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <m.dialog
      ref={ref}
      // Esc fires `cancel`; keep React state in charge of closing.
      onCancel={(e) => {
        e.preventDefault();
        if (dismissable) onClose();
      }}
      aria-labelledby={labelledBy}
      initial={{ y: 24, scale: 0.97 }}
      animate={{ y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, transition: { duration: 0.12 } }}
      transition={{ type: "spring", stiffness: 500, damping: 32 }}
      className={`m-auto w-full rounded-card border-[3px] border-line bg-surface p-0 text-ink shadow-hard-lg ${className}`}
    >
      {children}
    </m.dialog>
  );
}
