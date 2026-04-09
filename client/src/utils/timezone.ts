export const BUSINESS_TIMEZONE = "Asia/Kolkata"
export const BUSINESS_UTC_OFFSET = "+05:30"
export const DAY_MS = 24 * 60 * 60 * 1000

const BUSINESS_DAY_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

export function businessDayKey(date: Date): string {
  const parts = BUSINESS_DAY_FORMATTER.formatToParts(date)
  const year = parts.find((p) => p.type === "year")?.value
  const month = parts.find((p) => p.type === "month")?.value
  const day = parts.find((p) => p.type === "day")?.value
  if (!year || !month || !day) return ""
  return `${year}-${month}-${day}`
}

export function ymdToBusinessMidnightIso(ymd: string): string {
  return `${ymd}T00:00:00.000${BUSINESS_UTC_OFFSET}`
}

export function ymdToBusinessMidnightMs(ymd: string): number {
  return new Date(ymdToBusinessMidnightIso(ymd)).getTime()
}
