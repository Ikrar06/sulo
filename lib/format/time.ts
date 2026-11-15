// Display-layer time helpers. Times are stored as Unix seconds (UTC) and
// converted here with Intl in the given IANA time zone (the browser's, in
// production). Never a hardcoded offset.

import { id, type Messages } from '../i18n/id';
import type { UnixSeconds } from '../types';

const MIN = 60;
const HOUR = 3600;
const DAY = 86_400;

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

// Every formatter takes the active dictionary (Messages). Its `intl` tag
// drives Intl, and its `time` words build the phrases, so Indonesian and
// English share one implementation. The default is Indonesian.

type Words = Pick<Messages, 'intl' | 'time'>;

const fmtCache = new Map<string, Intl.DateTimeFormat>();
const fmt = (intl: string, timeZone: string, options: Intl.DateTimeFormatOptions) => {
  const key = `${intl}|${timeZone}|${JSON.stringify(options)}`;
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(intl, { timeZone, ...options });
    fmtCache.set(key, f);
  }
  return f;
};

export function formatClock(at: UnixSeconds, timeZone: string, m: Words = id): string {
  return fmt(m.intl, timeZone, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(at * 1000));
}

export function formatShortDate(at: UnixSeconds, timeZone: string, m: Words = id): string {
  return fmt(m.intl, timeZone, { day: 'numeric', month: 'short' }).format(new Date(at * 1000));
}

const weekday = (at: UnixSeconds, timeZone: string, m: Words, width: 'short' | 'long') =>
  fmt(m.intl, timeZone, { weekday: width }).format(new Date(at * 1000));

/** "Jum, 14 Nov 23.59", used in copied lists (always the date, never a countdown). */
export function formatDayDateTime(at: UnixSeconds, timeZone: string, m: Words = id): string {
  return `${weekday(at, timeZone, m, 'short')}, ${formatShortDate(at, timeZone, m)} ${formatClock(at, timeZone, m)}`;
}

/** Full date and time with the zone abbreviation, for tooltips ("... WITA"). */
export function formatFullDate(at: UnixSeconds, timeZone: string, m: Words = id): string {
  return fmt(m.intl, timeZone, {
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

/** "terlambat 2 jam", "terlambat 3 hari" (calendar days once past a day). */
function formatLate(dueAt: UnixSeconds, now: UnixSeconds, timeZone: string, m: Words): string {
  const late = now - dueAt;
  if (late < HOUR) return m.time.late(m.time.minutes(Math.max(1, Math.floor(late / MIN))));
  const days = -calendarDaysBetween(now, dueAt, timeZone);
  if (days < 1) return m.time.late(m.time.hours(Math.floor(late / HOUR)));
  return m.time.late(m.time.days(days));
}

/**
 * "Sisa waktu" as in docs/UI: "terlambat 2 hari", "45 menit", "6 jam",
 * "besok 23.59", "4 hari", "12 Des".
 */
export function formatRemaining(dueAt: UnixSeconds, now: UnixSeconds, timeZone: string, m: Words = id): string {
  const diff = dueAt - now;
  if (diff < 0) return formatLate(dueAt, now, timeZone, m);
  const days = calendarDaysBetween(now, dueAt, timeZone);
  if (days === 0) return diff < HOUR ? m.time.minutes(Math.max(1, Math.floor(diff / MIN))) : m.time.hours(Math.floor(diff / HOUR));
  if (days === 1) return m.time.tomorrow(formatClock(dueAt, timeZone, m));
  if (days < 7) return m.time.days(days);
  return formatShortDate(dueAt, timeZone, m);
}

/** Time left as a duration, for "Keduanya": "45 menit lagi", "5 jam lagi", "3 hari lagi". */
export function formatLeft(dueAt: UnixSeconds, now: UnixSeconds, timeZone: string, m: Words = id): string {
  const diff = dueAt - now;
  if (diff < 0) return formatLate(dueAt, now, timeZone, m);
  if (diff < HOUR) return m.time.left(m.time.minutes(Math.max(1, Math.floor(diff / MIN))));
  if (diff < DAY) return m.time.left(m.time.hours(Math.floor(diff / HOUR)));
  return m.time.left(m.time.days(Math.max(1, calendarDaysBetween(now, dueAt, timeZone))));
}

/** "Jam tenggat": "hari ini 23.59", "besok 08.00", "Kamis 23.59", or "12 Des 23.59" from 7 days on. */
export function formatDueClock(dueAt: UnixSeconds, now: UnixSeconds, timeZone: string, m: Words = id): string {
  const clock = formatClock(dueAt, timeZone, m);
  const days = calendarDaysBetween(now, dueAt, timeZone);
  if (days === 0) return m.time.today(clock);
  if (days === 1) return m.time.tomorrow(clock);
  if (days > 1 && days < 7) return `${weekday(dueAt, timeZone, m, 'long')} ${clock}`;
  return `${formatShortDate(dueAt, timeZone, m)} ${clock}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * "Hitung mundur": "05:12:30 lagi" under 24 hours, "2 hari 05:12:30" from
 * 24 hours. Past the due time it is never a negative countdown: it reads
 * "terlambat 2 jam" like the other formats.
 */
export function formatCountdown(dueAt: UnixSeconds, now: UnixSeconds, timeZone: string, m: Words = id): string {
  const diff = dueAt - now;
  if (diff < 0) return formatLate(dueAt, now, timeZone, m);
  const days = Math.floor(diff / DAY);
  const rest = diff - days * DAY;
  const hms = `${pad(Math.floor(rest / HOUR))}:${pad(Math.floor((rest % HOUR) / MIN))}:${pad(rest % MIN)}`;
  return days === 0 ? m.time.countdown(hms) : m.time.countdownDays(days, hms);
}

/** "5 menit lalu", "2 jam lalu", "3 hari lalu". */
export function formatAgo(at: UnixSeconds, now: UnixSeconds, m: Words = id): string {
  const diff = Math.max(0, now - at);
  if (diff < MIN) return m.time.justNow;
  if (diff < HOUR) return m.time.ago(m.time.minutes(Math.floor(diff / MIN)));
  if (diff < DAY) return m.time.ago(m.time.hours(Math.floor(diff / HOUR)));
  return m.time.ago(m.time.days(Math.floor(diff / DAY)));
}
