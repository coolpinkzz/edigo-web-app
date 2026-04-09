import type { ClassPerformanceRowDto } from '../../types'
import { cn, formatInr } from '../../utils'

export function ClassPerformanceChart({
  rows,
  loading,
  errorMessage,
  className,
  segmentLabel = "class",
}: {
  rows: ClassPerformanceRowDto[] | undefined
  loading: boolean
  errorMessage?: string | null
  className?: string
  /** For empty state / a11y copy: "class" (school) or "course" (academy). */
  segmentLabel?: "class" | "course"
}) {
  if (errorMessage) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {errorMessage}
      </p>
    )
  }

  if (loading) {
    return (
      <div
        className="space-y-4 py-4"
        aria-busy
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse space-y-2">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-2.5 rounded-full bg-muted" />
          </div>
        ))}
      </div>
    )
  }

  if (!rows?.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {segmentLabel === "course"
          ? "No fee assignments by course yet."
          : "No fee assignments by class yet."}
      </p>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {rows.map((r) => (
        <div
          key={r.courseId ?? r.className}
          className="min-w-0"
        >
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-medium text-foreground">{r.className}</span>
            <span className="tabular-nums text-muted-foreground">
              <span className="font-semibold text-foreground">
                {r.percentCollected.toFixed(1)}%
              </span>
              <span className="mx-1.5 text-border">·</span>
              <span title="Collected of total assigned">
                {formatInr(r.paidAmount)} / {formatInr(r.totalAmount)}
              </span>
            </span>
          </div>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={Math.round(r.percentCollected)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${r.className}: ${r.percentCollected.toFixed(1)}% collected`}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${Math.min(100, r.percentCollected)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
