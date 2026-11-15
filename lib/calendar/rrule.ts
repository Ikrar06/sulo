// Weekly class meetings as one recurring ICS event (for M7, the personal
// schedule download; never hosted). Pure.
// - DTSTART/DTEND with TZID=Asia/Makassar and a VTIMEZONE block
// - UNTIL in UTC with a trailing Z (RFC 5545: required when DTSTART has TZID)
// - EXDATE (same TZID and time as DTSTART) for holidays and, by default, the
//   UTS week
// - by default the series ends the day before UAS starts
// Both defaults can be turned off. UNTIL is computed through Intl
// (zonedToUnix), never from a hand-written offset.

import { zonedToUnix } from '../reminders/zoned';
import { addDays, toBasic, weekday } from './dates.ts';
import { escapeText, foldLine } from './ics.ts';
import type { PekanSemester } from './schema.ts';

export const SCHEDULE_TZID = 'Asia/Makassar';

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

export interface RecurringClass {
  /** e.g. `jadwal-{kode_mk}-{kelas}-{tahun_ajaran}-{semester}` (docs/KALENDER-AKADEMIK.md). */
  uidBase: string;
  summary: string;
  location?: string;
  /** Date of the first meeting; its weekday is the meeting day. */
  firstDate: string;
  /** "HH:MM", local time. */
  start: string;
  end: string;
}

export interface RecurrenceOptions {
  pekan: PekanSemester;
  /** First day of UAS (from the calendar). */
  uasStart: string;
  /** Inclusive day ranges without class (national holidays and similar). */
  holidays: readonly { mulai: string; selesai: string }[];
  excludeUtsWeek?: boolean;
  endBeforeUas?: boolean;
}

export interface Recurrence {
  until: string;
  /** Meeting dates removed from the series. */
  exdates: string[];
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const localStamp = (date: string, hhmm: string) => `${toBasic(date)}T${hhmm.replace(':', '')}00`;
const utcStamp = (unix: number) => new Date(unix * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Last allowed day and the dates to skip. */
export function planRecurrence(cls: RecurringClass, o: RecurrenceOptions): Recurrence {
  const lastWeek = o.pekan.pekan.at(-1)!;
  const until = o.endBeforeUas === false ? addDays(lastWeek.mulai, 6) : addDays(o.uasStart, -1);
  const utsWeek = o.pekan.uts_pekan === null ? undefined : o.pekan.pekan.find((p) => p.nomor === o.pekan.uts_pekan);
  const inRange = (d: string, from: string, to: string) => d >= from && d <= to;
  const exdates: string[] = [];
  for (let d = cls.firstDate; d <= until; d = addDays(d, 7)) {
    const holiday = o.holidays.some((h) => inRange(d, h.mulai, h.selesai));
    const uts = (o.excludeUtsWeek ?? true) && utsWeek !== undefined && inRange(d, utsWeek.mulai, addDays(utsWeek.mulai, 6));
    if (holiday || uts) exdates.push(d);
  }
  return { until, exdates };
}

/** Meeting dates the series produces (for tests and previews). */
export function expandOccurrences(cls: RecurringClass, r: Recurrence): string[] {
  const out: string[] = [];
  for (let d = cls.firstDate; d <= r.until; d = addDays(d, 7)) if (!r.exdates.includes(d)) out.push(d);
  return out;
}

export function buildRecurringEvent(cls: RecurringClass, o: RecurrenceOptions, dtstamp: string): string[] {
  const r = planRecurrence(cls, o);
  // UNTIL: the end of the last allowed day, local time, as UTC.
  const untilUtc = utcStamp(zonedToUnix(r.until, 23 * 60 + 59, SCHEDULE_TZID) + 59);
  const lines = [
    'BEGIN:VEVENT',
    `UID:${cls.uidBase}@sulo`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=${SCHEDULE_TZID}:${localStamp(cls.firstDate, cls.start)}`,
    `DTEND;TZID=${SCHEDULE_TZID}:${localStamp(cls.firstDate, cls.end)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[weekday(cls.firstDate)]};UNTIL=${untilUtc}`,
    ...(r.exdates.length > 0 ? [`EXDATE;TZID=${SCHEDULE_TZID}:${r.exdates.map((d) => localStamp(d, cls.start)).join(',')}`] : []),
    `SUMMARY:${escapeText(cls.summary)}`,
    ...(cls.location ? [`LOCATION:${escapeText(cls.location)}`] : []),
    'END:VEVENT',
  ];
  if (minutes(cls.end) <= minutes(cls.start)) throw new Error(`class ends before it starts: ${cls.summary}`);
  return lines.map(foldLine);
}

/**
 * VTIMEZONE for Asia/Makassar. iCalendar requires the offset written out;
 * WITA has been UTC+08:00 without daylight saving since 1932.
 */
export const VTIMEZONE_MAKASSAR = [
  'BEGIN:VTIMEZONE',
  `TZID:${SCHEDULE_TZID}`,
  'BEGIN:STANDARD',
  'DTSTART:19700101T000000',
  'TZOFFSETFROM:+0800',
  'TZOFFSETTO:+0800',
  'TZNAME:WITA',
  'END:STANDARD',
  'END:VTIMEZONE',
];
