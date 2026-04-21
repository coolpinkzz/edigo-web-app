import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button, type ButtonVariant } from "./ui/Button";

export type ConfirmationModalProps = {
  open: boolean;
  /** Called when the user dismisses via backdrop, Escape, or Cancel (pass `false`). */
  onOpenChange: (open: boolean) => void;
  /** Optional visual (e.g. avatar) shown above the title. */
  media?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Primary action (e.g. submit). */
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Disables actions and shows loading on the confirm button. */
  isConfirming?: boolean;
  confirmVariant?: ButtonVariant;
};

/**
 * Accessible confirmation overlay (portal to `document.body`). Reusable for destructive
 * or high-impact actions (submit attendance, delete, etc.).
 */
export function ConfirmationModal({
  open,
  onOpenChange,
  media,
  title,
  description,
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isConfirming = false,
  confirmVariant = "primary",
}: ConfirmationModalProps) {
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isConfirming) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, isConfirming, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[1px]"
        aria-label="Close dialog"
        disabled={isConfirming}
        onClick={() => !isConfirming && onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="relative z-[1] w-full max-w-md rounded-2xl border border-card-border bg-card p-6 shadow-xl shadow-black/[0.12]"
      >
        {media != null && (
          <div className="mb-4 flex justify-center">{media}</div>
        )}
        <h2
          id={titleId}
          className="text-lg font-semibold text-foreground"
        >
          {title}
        </h2>
        {description != null && description !== "" && (
          <div
            id={descId}
            className="mt-2 text-sm text-muted-foreground [&_strong]:text-foreground"
          >
            {description}
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={isConfirming}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            disabled={isConfirming}
            onClick={onConfirm}
          >
            {isConfirming ? "Please wait…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
