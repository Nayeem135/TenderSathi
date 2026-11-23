// ConfirmDialog: asks "are you sure?" before something that cannot be
// undone, such as deleting a contract. Replaces the browser's plain
// window.confirm() pop-up with one that matches the app.
import { AlertTriangle } from "lucide-react";
import { useEffect, useRef } from "react";

import Button from "./Button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  isWorking?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  isWorking = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // When it opens: put the keyboard focus on "Cancel" (the safe choice),
  // and let the Escape key close it.
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      {/* The dark see-through layer behind the box. Clicking it cancels. */}
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="relative w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl ring-1 ring-slate-900/5 dark:ring-white/10"
      >
        <div className="flex gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400">
            <AlertTriangle aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 id="confirm-title" className="text-base font-semibold text-fg">
              {title}
            </h2>
            <p id="confirm-message" className="mt-1.5 text-sm text-fg-3">
              {message}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={isWorking}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} isLoading={isWorking}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
