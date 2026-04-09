export const BUSINESS_TIMEZONE = "Asia/Kolkata";
export const BUSINESS_UTC_OFFSET = "+05:30";
export const DAY_MS = 24 * 60 * 60 * 1000;

const BUSINESS_DAY_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function businessDayKey(d: Date): string {
  const parts = BUSINESS_DAY_FORMATTER.formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("Could not derive business date key");
  }
  return `${year}-${month}-${day}`;
}

/** Business-day midnight represented as a UTC instant. */
export function startOfBusinessDay(d: Date): Date {
  return new Date(`${businessDayKey(d)}T00:00:00.000${BUSINESS_UTC_OFFSET}`);
}

export function parseBusinessYmdToDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000${BUSINESS_UTC_OFFSET}`);
}
