// Display-layer time helpers. Times are stored as Unix seconds (UTC) and
// converted here with Intl in the given IANA time zone (the browser's, in
// production). Never a hardcoded offset.

import type { UnixSeconds } from '../types';

const MIN = 60;
const HOUR = 3600;

const dateKeyFormatters = new Map<string, Intl.DateTimeFormat>();

/** Local calendar date YYYY-MM-DD of a timestamp in `timeZone`. */
export function localDateKey(at: UnixSeconds, timeZone: string): string {
  let f = dateKeyFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    dateKeyFormatters.set(timeZone, f);
  }
  return f.format(new Date(at * 1000));
}

/** Whole local calendar days from `now` to `at` (negative in the past). */
export function calendarDaysBetween(now: UnixSeconds, at: UnixSeconds, timeZone: string): number {
  const toUtcMidnight = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
  return Math.round((toUtcMidnight(localDateKey(at, timeZone)) - toUtcMidnight(localDateKey(now, timeZone))) / 86_400_000);
}

const fmt = (timeZone: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('id-ID', { timeZone, ...options });

export function formatClock(at: UnixSeconds, timeZone: string): string {
  return fmt(timeZone, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(at * 1000));
}

export function formatShortDate(at: UnixSeconds, timeZone: string): string {
  return fmt(timeZone, { day: 'numeric', month: 'short' }).format(new Date(at * 1000));
}

/** "Jum, 14 Nov 23.59", used in copied lists. */
export function formatDayDateTime(at: UnixSeconds, timeZone: string): string {
  const d = new Date(at * 1000);
  const day = fmt(timeZone, { weekday: 'short' }).format(d);
  return `${day}, ${formatShortDate(at, timeZone)} ${formatClock(at, timeZone)}`;
}

/** Full date and time with the zone abbreviation, for tooltips ("... WITA"). */
export function formatFullDate(at: UnixSeconds, timeZone: string): string {
  return fmt(timeZone, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(new Date(at * 1000));
}

/**
 * Remaining time as in docs/UI: "terlambat 2 hari", "45 mnt", "6 jam",
 * "besok 23.59", "4 hari", "12 Des".
 */
export function formatRemaining(dueAt: UnixSeconds, now: UnixSeconds, timeZone: string): string {
  const diff = dueAt - now;
  if (diff < 0) {
    const late = -diff;
    if (late < HOUR) return `terlambat ${Math.max(1, Math.floor(late / MIN))} mnt`;
    const days = -calendarDaysBetween(now, dueAt, timeZone);
    if (days < 1) return `terlambat ${Math.floor(late / HOUR)} jam`;
    return `terlambat ${days} hari`;
  }
  const days = calendarDaysBetween(now, dueAt, timeZone);
  if (days === 0) return diff < HOUR ? `${Math.max(1, Math.floor(diff / MIN))} mnt` : `${Math.floor(diff / HOUR)} jam`;
  if (days === 1) return `besok ${formatClock(dueAt, timeZone)}`;
  if (days < 7) return `${days} hari`;
  return formatShortDate(dueAt, timeZone);
}

/** "5 mnt lalu", "2 jam lalu", "3 hari lalu". */
export function formatAgo(at: UnixSeconds, now: UnixSeconds): string {
  const diff = Math.max(0, now - at);
  if (diff < MIN) return 'baru saja';
  if (diff < HOUR) return `${Math.floor(diff / MIN)} mnt lalu`;
  if (diff < 24 * HOUR) return `${Math.floor(diff / HOUR)} jam lalu`;
  return `${Math.floor(diff / (24 * HOUR))} hari lalu`;
}
