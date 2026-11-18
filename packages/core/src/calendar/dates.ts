// Calendar-date arithmetic on YYYY-MM-DD keys. Pure, UTC-based so the result
// never depends on the machine's time zone (dates here are not instants).

export function addDays(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekday(key: string): number {
  return new Date(`${key}T00:00:00Z`).getUTCDay();
}

/** "20260626" -> "2026-06-26". */
export function fromBasic(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

/** "2026-06-26" -> "20260626". */
export function toBasic(key: string): string {
  return key.replaceAll('-', '');
}
