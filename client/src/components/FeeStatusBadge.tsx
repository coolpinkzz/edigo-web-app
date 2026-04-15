import type { ReactNode } from "react";
import type { FeeStatus } from "../types";
import { cn } from "../utils";

/** Solid bright pills — white text on saturated fills. */
export function feeStatusBadgeClass(status: FeeStatus | null): string {
  if (status == null) return "bg-muted text-muted-foreground";
  switch (status) {
    case "OVERDUE":
      return "bg-red-400 text-red-950 dark:bg-red-300";
    case "PARTIAL":
      return "bg-amber-300 text-amber-800 dark:bg-amber-200";
    case "PENDING":
      return "border border-primary text-primary dark:border-primary";
    case "PAID":
      return "bg-primary-gradient text-white dark:bg-primary-gradient";
    default:
      return "bg-muted text-muted-foreground";
  }
}

const VARIANT_CLASSES = {
  default: "inline-flex rounded-lg px-2.5 py-1 text-xs font-medium",
  compact: "inline-flex rounded-lg px-2 py-0.5 text-[10px] font-medium",
} as const;

export type FeeStatusBadgeVariant = keyof typeof VARIANT_CLASSES;

export type FeeStatusBadgeProps = {
  status: FeeStatus | null;
  children: ReactNode;
  variant?: FeeStatusBadgeVariant;
  className?: string;
};

export function FeeStatusBadge({
  status,
  children,
  variant = "default",
  className,
}: FeeStatusBadgeProps) {
  return (
    <span
      className={cn(
        VARIANT_CLASSES[variant],
        feeStatusBadgeClass(status),
        className,
      )}
    >
      {children}
    </span>
  );
}
