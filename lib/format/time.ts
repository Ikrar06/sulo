// Display-layer time helpers. Times are stored as Unix seconds (UTC) and
// converted here with Intl in the given IANA time zone (the browser's, in
// production). Never a hardcoded offset.

import { localParts } from '../reminders/zoned';
import { formatCountdown } from './countdown';
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

/**
 * The one absolute date format: "Jum, 13 Nov, 23.59" (id) and
 * "Fri, 13 Nov, 11:59 PM" (en). No zone name: every user is in WITA, and
 * the browser zone is used anyway. Every absolute due date uses this.
 */
export function formatDue(at: UnixSeconds, locale: 'id' | 'en', timeZone: string): string {
  const id = locale === 'id';
  const parts = fmt(id ? 'id-ID' : 'en-US', timeZone, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    ...(id ? { hourCycle: 'h23' as const } : { hour12: true }),
  }).formatToParts(new Date(at * 1000));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  const time = id ? `${get('hour').padStart(2, '0')}.${get('minute')}` : `${get('hour')}:${get('minute')} ${get('dayPeriod').toUpperCase()}`;
  const base = `${get('weekday')}, ${get('day')} ${get('month')}, ${time}`;
  // Exactly 00.00 belongs to the night before: "Rab, 18 Nov, 00.00 (Selasa tengah malam)".
  const local = localParts(at, timeZone);
  if (local.minuteOfDay !== 0) return base;
  const eve = fmt(id ? 'id-ID' : 'en-US', timeZone, { weekday: 'long' }).format(new Date((at - 60) * 1000));
  return id ? `${base} (${eve} tengah malam)` : `${base} (${eve} midnight)`;
}

/** The locale behind a dictionary ("id-ID" -> id). */
export const localeOf = (m: Words): 'id' | 'en' => (m.intl.startsWith('id') ? 'id' : 'en');

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
 * "Hitung mundur" for a due time: the clock from lib/format/countdown.ts
 * ("00:45:09", "2 hari 03:15:42"), or the usual "terlambat …" label once the
 * deadline has passed (never a negative clock).
 */
export function countdownOrLate(dueAt: UnixSeconds, now: UnixSeconds, timeZone: string, m: Words = id): string {
  return formatCountdown((dueAt - now) * 1000, localeOf(m)) ?? formatLate(dueAt, now, timeZone, m);
}

/** "5 menit lalu", "2 jam lalu", "3 hari lalu". */
export function formatAgo(at: UnixSeconds, now: UnixSeconds, m: Words = id): string {
  const diff = Math.max(0, now - at);
  if (diff < MIN) return m.time.justNow;
  if (diff < HOUR) return m.time.ago(m.time.minutes(Math.floor(diff / MIN)));
  if (diff < DAY) return m.time.ago(m.time.hours(Math.floor(diff / HOUR)));
  return m.time.ago(m.time.days(Math.floor(diff / DAY)));
}

/**
 * The two lines on the right of a task row in the dashboard: time left on
 * top ("19 hari lagi", "terlambat 2 jam"), the full date below. In the
 * "due time" mode the date alone is enough, on one line.
 */
export function taskDueLines(dueAt: UnixSeconds, now: UnixSeconds, timeZone: string, m: Words, locale: 'id' | 'en', format: 'both' | 'remaining' | 'clock' | 'countdown'): { primary: string; secondary: string | null } {
  const full = formatDue(dueAt, locale, timeZone);
  if (format === 'clock') return { primary: full, secondary: null };
  if (format === 'countdown') return { primary: countdownOrLate(dueAt, now, timeZone, m), secondary: full };
  return { primary: formatLeft(dueAt, now, timeZone, m), secondary: full };
}

/** The browser's own time zone (display only; stored times stay UTC). */
export const browserTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;
