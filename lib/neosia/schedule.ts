// The weekly class schedule from NEOSIA against the academic calendar
// (M7 part E3): the semester's teaching weeks, holidays on class days, the
// meetings of a week or a range, and the recurring ICS file (brief 3.4,
// lib/calendar/rrule.ts). Pure; never a request, never hosted: the ICS is a
// local download only.

import { addDays, weekday } from '../calendar/dates.ts';
import { foldLine, ICS_PRODID } from '../calendar/ics.ts';
import { buildRecurringEvent, VTIMEZONE_MAKASSAR } from '../calendar/rrule';
import type { CalendarFile, PekanSemester } from '../calendar/schema.ts';
import type { ClassMeeting } from './view';

export interface SemesterRange {
  semester: 'awal' | 'akhir';
  pekan: PekanSemester;
  /** Monday of week 1. */
  start: string;
  /** Sunday of the last numbered week. */
  end: string;
  /** First day of UAS, when the calendar has it. */
  uasStart: string | null;
}

/** The semester whose teaching weeks hold `today`, else the next one, else null. */
export function semesterRange(file: CalendarFile, today: string): SemesterRange | null {
  const ranges = (['awal', 'akhir'] as const)
    .map((semester) => {
      const pekan = file.pekan[semester];
      if (!pekan || pekan.pekan.length === 0) return null;
      const uas = file.kegiatan.find((k) => k.kategori === 'uas' && k.semester === semester);
      return { semester, pekan, start: pekan.pekan[0]!.mulai, end: addDays(pekan.pekan.at(-1)!.mulai, 6), uasStart: uas?.mulai ?? null };
    })
    .filter((r): r is SemesterRange => r !== null)
    .sort((a, b) => a.start.localeCompare(b.start));
  return ranges.find((r) => r.start <= today && today <= r.end) ?? ranges.find((r) => r.start > today) ?? null;
}

/** Inclusive day ranges without class: national holidays and joint leave, and calendar "libur" events. */
export function holidayRanges(file: CalendarFile): { mulai: string; selesai: string; nama: string }[] {
  return [
    ...file.libur_nasional.map((l) => ({ mulai: l.mulai, selesai: l.selesai ?? l.mulai, nama: l.nama })),
    ...file.kegiatan.filter((k) => k.kategori === 'libur' && !k.perkiraan).map((k) => ({ mulai: k.mulai, selesai: k.selesai ?? k.mulai, nama: k.judul })),
  ];
}

/** The holiday on a date, or null. */
export function holidayOn(ranges: readonly { mulai: string; selesai: string; nama: string }[], day: string): string | null {
  return ranges.find((h) => h.mulai <= day && day <= h.selesai)?.nama ?? null;
}

/** Monday of the ISO week holding `day`. */
export function mondayOf(day: string): string {
  return addDays(day, -((weekday(day) + 6) % 7));
}

export interface Occurrence<M extends ClassMeeting = ClassMeeting> {
  meeting: M;
  day: string;
  /** Holiday name when the meeting falls on one (shown dimmed with the label). */
  holiday: string | null;
}

/** Every meeting from `from` to `to` (inclusive), by day and start time. */
export function occurrences<M extends ClassMeeting>(meetings: readonly M[], from: string, to: string, holidays: readonly { mulai: string; selesai: string; nama: string }[]): Occurrence<M>[] {
  const out: Occurrence<M>[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const wd = weekday(day);
    for (const meeting of meetings) if (meeting.weekday === wd) out.push({ meeting, day, holiday: holidayOn(holidays, day) });
  }
  return out;
}

const uidPart = (s: string | null) => (s ?? 'x').toLowerCase().replace(/[^0-9a-z]+/g, '-').replace(/^-+|-+$/g, '') || 'x';

/**
 * One VCALENDAR with a weekly series per meeting: from the first matching
 * day of week 1 to the day before UAS, holidays and the UTS week skipped
 * (lib/calendar/rrule.ts). null when the calendar has no teaching weeks for
 * the semester yet. The file stays on the user's computer.
 */
export function scheduleIcs(meetings: readonly ClassMeeting[], file: CalendarFile, range: SemesterRange | null, semesterLabel: { tahunAjaran: string | null; jenis: string | null }, dtstamp: string): string | null {
  if (!range || !range.uasStart || meetings.length === 0) return null;
  const holidays = holidayRanges(file).map(({ mulai, selesai }) => ({ mulai, selesai }));
  const events = meetings.flatMap((m, i) => {
    const offset = (m.weekday - weekday(range.start) + 7) % 7;
    const firstDate = addDays(range.start, offset);
    const uidBase = ['jadwal', uidPart(m.code ?? m.name), uidPart(m.className), uidPart(semesterLabel.tahunAjaran ?? file.tahun_ajaran), uidPart(semesterLabel.jenis ?? range.semester), String(i)].join('-');
    const summary = m.className ? `${m.name} ${m.className}` : m.name;
    try {
      return buildRecurringEvent({ uidBase, summary, location: m.room ?? undefined, firstDate, start: m.start, end: m.end }, { pekan: range.pekan, uasStart: range.uasStart!, holidays }, dtstamp);
    } catch {
      return [];
    }
  });
  if (events.length === 0) return null;
  // Event lines come folded from buildRecurringEvent; only the frame is folded here.
  const head = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${ICS_PRODID}`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Jadwal kuliah (Sulo)', ...VTIMEZONE_MAKASSAR].map(foldLine);
  return `${[...head, ...events, 'END:VCALENDAR'].join('\r\n')}\r\n`;
}
