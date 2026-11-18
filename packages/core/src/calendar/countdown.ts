// The countdown under "Tanggal penting terdekat". Pure; dates are local keys.

import { daysBetween } from './dates.ts';

export type Countdown =
  | { kind: 'today' }
  | { kind: 'tomorrow' }
  | { kind: 'days'; n: number }
  | { kind: 'ongoing'; until: string }
  | { kind: 'ongoingOpen' };

export function countdownOf(event: { mulai: string; selesai: string | null }, today: string): Countdown {
  if (event.mulai > today) {
    const n = daysBetween(today, event.mulai);
    return n === 1 ? { kind: 'tomorrow' } : { kind: 'days', n };
  }
  if (event.selesai === null) return { kind: 'ongoingOpen' };
  if (event.selesai === today) return { kind: 'today' };
  return { kind: 'ongoing', until: event.selesai };
}

/** A local date key shown as a date (never shifted by the machine's time zone). */
export function formatDateKey(key: string, intl: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  return new Intl.DateTimeFormat(intl, { ...options, timeZone: 'UTC' }).format(new Date(`${key}T00:00:00Z`));
}

/** "5 Okt 2026" or "30 Nov sampai 5 Des 2026"; open ends say so. */
export function formatRange(event: { mulai: string; selesai: string | null }, intl: string, to: string, open: string): string {
  if (event.selesai === null) return `${formatDateKey(event.mulai, intl)} (${open})`;
  if (event.selesai === event.mulai) return formatDateKey(event.mulai, intl);
  const sameYear = event.mulai.slice(0, 4) === event.selesai.slice(0, 4);
  const start = formatDateKey(event.mulai, intl, sameYear ? { day: 'numeric', month: 'short' } : undefined);
  return `${start} ${to} ${formatDateKey(event.selesai, intl)}`;
}
