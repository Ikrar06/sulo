// Local wall-clock math in an IANA time zone, with Intl only (never a fixed
// offset). Used for quiet hours, "tomorrow morning" and the morning summary.

import type { UnixSeconds } from '../types';

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

export interface LocalParts {
  /** YYYY-MM-DD */
  dateKey: string;
  /** Minutes since local midnight, 0..1439. */
  minuteOfDay: number;
}

function rawParts(at: UnixSeconds, timeZone: string) {
  const get = (type: string, parts: Intl.DateTimeFormatPart[]) => Number(parts.find((p) => p.type === type)?.value);
  const parts = formatter(timeZone).formatToParts(new Date(at * 1000));
  return {
    y: get('year', parts),
    mo: get('month', parts),
    d: get('day', parts),
    h: get('hour', parts),
    mi: get('minute', parts),
    s: get('second', parts),
  };
}

export function localParts(at: UnixSeconds, timeZone: string): LocalParts {
  const p = rawParts(at, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { dateKey: `${p.y}-${pad(p.mo)}-${pad(p.d)}`, minuteOfDay: p.h * 60 + p.mi };
}

/** Local wall time minus UTC, in seconds, at the instant `at`. */
function offsetAt(at: UnixSeconds, timeZone: string): number {
  const p = rawParts(at, timeZone);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) / 1000 - at;
}

/** The instant when the local clock in `timeZone` shows `dateKey` at `minuteOfDay`. */
export function zonedToUnix(dateKey: string, minuteOfDay: number, timeZone: string): UnixSeconds {
  const [y, mo, d] = dateKey.split('-').map(Number) as [number, number, number];
  const wall = Date.UTC(y, mo - 1, d, 0, minuteOfDay) / 1000;
  // Two passes settle the offset, also around daylight-saving changes.
  let at = wall - offsetAt(wall, timeZone);
  at = wall - offsetAt(at, timeZone);
  return at;
}

export function addDays(dateKey: string, days: number): string {
  const [y, mo, d] = dateKey.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, mo - 1, d + days)).toISOString().slice(0, 10);
}

/** The first instant strictly after `after` when the local clock shows `minuteOfDay`. */
export function nextLocalTime(after: UnixSeconds, minuteOfDay: number, timeZone: string): UnixSeconds {
  const today = localParts(after, timeZone).dateKey;
  const candidate = zonedToUnix(today, minuteOfDay, timeZone);
  return candidate > after ? candidate : zonedToUnix(addDays(today, 1), minuteOfDay, timeZone);
}

export interface Window {
  /** Minutes since local midnight. A window may cross midnight (start > end). */
  startMin: number;
  endMin: number;
}

export function inWindow(at: UnixSeconds, window: Window, timeZone: string): boolean {
  const { startMin, endMin } = window;
  if (startMin === endMin) return false;
  const m = localParts(at, timeZone).minuteOfDay;
  return startMin < endMin ? m >= startMin && m < endMin : m >= startMin || m < endMin;
}

/** When the window containing `at` ends; `at` itself when it is outside the window. */
export function windowEnd(at: UnixSeconds, window: Window, timeZone: string): UnixSeconds {
  return inWindow(at, window, timeZone) ? nextLocalTime(at, window.endMin, timeZone) : at;
}
