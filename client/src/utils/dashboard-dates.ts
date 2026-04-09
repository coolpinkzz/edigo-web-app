/** Local calendar day as `YYYY-MM-DD` (for API range). */
export function formatDateInputLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalDateString(str: string): Date | null {
  const parts = str.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return null;
  }
  const [y, m, d] = parts;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function defaultCustomDateStrings(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  return { from: formatDateInputLocal(from), to: formatDateInputLocal(to) };
}

export function parseDateInputRange(fromStr: string, toStr: string): {
  from: Date;
  to: Date;
  valid: boolean;
} {
  const fromParts = fromStr.split("-").map(Number);
  const toParts = toStr.split("-").map(Number);
  if (
    fromParts.length !== 3 ||
    toParts.length !== 3 ||
    fromParts.some((n) => Number.isNaN(n)) ||
    toParts.some((n) => Number.isNaN(n))
  ) {
    return {
      from: new Date(0),
      to: new Date(),
      valid: false,
    };
  }
  const [fy, fm, fd] = fromParts;
  const [ty, tm, td] = toParts;
  const from = new Date(fy, fm - 1, fd, 0, 0, 0, 0);
  const to = new Date(ty, tm - 1, td, 23, 59, 59, 999);
  return {
    from,
    to,
    valid: from.getTime() <= to.getTime(),
  };
}
