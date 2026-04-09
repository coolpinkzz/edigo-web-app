import { DAY_MS, businessDayKey, ymdToBusinessMidnightMs } from "./timezone"

/**
 * Server stores installments as amount + dueInDays (days after assignment anchor).
 * The form uses calendar dates; we convert by using the earliest due date as day 0.
 */
/** Earliest calendar date among rows (YYYY-MM-DD). Used as assignment anchor for template fees. */
export function earliestDueDateString(
  rows: { dueDate: string }[],
): string | undefined {
  if (rows.length === 0) return undefined
  const parse = (d: string) => {
    const t = ymdToBusinessMidnightMs(d.trim())
    return Number.isNaN(t) ? 0 : t
  }
  const sorted = [...rows].sort((a, b) => parse(a.dueDate) - parse(b.dueDate))
  return sorted[0].dueDate.trim()
}

export function buildDefaultInstallments(
  rows: { amount: number; dueDate: string }[],
): { amount: number; dueInDays: number }[] {
  if (rows.length === 0) return []
  const parse = (d: string) => {
    const t = ymdToBusinessMidnightMs(d)
    return Number.isNaN(t) ? 0 : t
  }
  const sorted = [...rows].sort((a, b) => parse(a.dueDate) - parse(b.dueDate))
  const ref = parse(sorted[0].dueDate)
  return sorted.map((row) => ({
    amount: row.amount,
    dueInDays: Math.max(0, Math.round((parse(row.dueDate) - ref) / DAY_MS)),
  }))
}

/** Split `total` into `count` parts; last item absorbs rounding remainder (2 decimal places). */
export function splitEqualAmounts(total: number, count: number): number[] {
  if (count <= 0 || total <= 0) return []
  const cents = Math.round(total * 100)
  const base = Math.floor(cents / count)
  const remainder = cents - base * count
  const parts: number[] = []
  for (let i = 0; i < count; i += 1) {
    const c = base + (i === count - 1 ? remainder : 0)
    parts.push(c / 100)
  }
  return parts
}

/** Today as YYYY-MM-DD (IST). */
export function todayISODate(): string {
  return businessDayKey(new Date())
}

/** Add whole days to an ISO date string (YYYY-MM-DD), returns YYYY-MM-DD (IST). */
export function addDaysToISODate(iso: string, days: number): string {
  const t = ymdToBusinessMidnightMs(iso) + days * DAY_MS
  return businessDayKey(new Date(t))
}

/**
 * Inverse of `buildDefaultInstallments`: maps API `dueInDays` rows to calendar dates for the form.
 * Uses today as day 0 so relative spacing matches what the server stores.
 */
export function defaultInstallmentsToFormRows(
  rows: { amount: number; dueInDays: number }[],
): { amount: number; dueDate: string }[] {
  if (rows.length === 0) return []
  const sorted = [...rows].sort((a, b) => a.dueInDays - b.dueInDays)
  const base = todayISODate()
  return sorted.map((row) => ({
    amount: row.amount,
    dueDate: addDaysToISODate(base, row.dueInDays),
  }))
}
