// Calendar filter groups and their colors: the chips above the month grid
// are both the legend and the filter. Pure data; the colors live in
// components/dashboard/dashboard.css (.db-cat-*), checked by
// scripts/contrast.mjs.

import { z } from 'zod';
import { addDays } from './dates.ts';
import type { CalendarFile, Kategori, Kegiatan, Libur } from './schema.ts';

export const CALENDAR_GROUPS = ['akademik', 'ujian', 'administrasi', 'libur', 'wisuda', 'tugas', 'kuliah', 'penerimaan'] as const;
export type CalendarGroup = (typeof CALENDAR_GROUPS)[number];

/** Every category in the data belongs to exactly one group (and so one color). */
export const GROUP_OF_KATEGORI: Readonly<Record<Kategori, CalendarGroup>> = {
  uts: 'ujian',
  uas: 'ujian',
  krs: 'administrasi',
  administrasi: 'administrasi',
  jadwal: 'administrasi',
  nilai: 'administrasi',
  sanggah: 'administrasi',
  evaluasi: 'administrasi',
  libur: 'libur',
  wisuda: 'wisuda',
  perkuliahan: 'akademik',
  kkn: 'akademik',
  lainnya: 'akademik',
  penerimaan: 'penerimaan',
};

/**
 * Long status periods: shown as a faint cell tint with a small label on the
 * first cell of each week, never as bars (they would fill every lane).
 * Semester breaks (48 to 69 days), KKN (about 90 days) and admissions
 * windows (up to 212 days). Lectures have no period in the data, only their
 * first and last days, which stay ordinary events.
 */
export const STATUS_PERIOD_KATEGORI: ReadonlySet<Kategori> = new Set(['libur', 'kkn', 'penerimaan']);

export type GroupFilter = Record<CalendarGroup, boolean>;

/**
 * Everything on except admissions, which matter to applicants only, and
 * classes (NEOSIA, M7), which would fill every weekday of the month grid.
 */
export const DEFAULT_GROUP_FILTER: GroupFilter = { akademik: true, ujian: true, administrasi: true, libur: true, wisuda: true, tugas: true, kuliah: false, penerimaan: false };

export const groupFilterSchema = z
  .object(Object.fromEntries(CALENDAR_GROUPS.map((g) => [g, z.boolean().catch(DEFAULT_GROUP_FILTER[g])])) as Record<CalendarGroup, z.ZodCatch<z.ZodBoolean>>)
  .catch(DEFAULT_GROUP_FILTER);

/** One thing on the calendar, with an inclusive local date range. */
export interface CalEvent {
  id: string;
  group: CalendarGroup;
  title: string;
  start: string;
  end: string;
  /** Status periods are tints, not bars. */
  period: boolean;
  source:
    | { type: 'kegiatan'; kegiatan: Kegiatan }
    | { type: 'libur'; libur: Libur }
    | { type: 'tugas'; eventId: number; courseName: string; courseColor: number; dueAt: number }
    /** A class meeting from the NEOSIA schedule (M7); `holiday` names the holiday it falls on. */
    | { type: 'kuliah'; courseName: string; courseColor: number | null; start: string; end: string; room: string | null; holiday: string | null };
}

/** One class meeting on one day (lib/neosia/schedule.ts occurrences, with the linked course). */
export interface ClassForCalendar {
  id: string;
  dateKey: string;
  name: string;
  courseColor: number | null;
  start: string;
  end: string;
  room: string | null;
  holiday: string | null;
}

export interface TaskForCalendar {
  eventId: number;
  name: string;
  courseName: string;
  courseColor: number;
  dueAt: number;
  dateKey: string;
}

/**
 * Events, holidays and task deadlines that pass the filter. Month-level
 * estimates are left out of the grid (they would span whole months); the
 * list asks for them. An open end lasts one day.
 */
export function calendarEvents(file: CalendarFile, tasks: readonly TaskForCalendar[], filter: GroupFilter, options: { estimates?: boolean; classes?: readonly ClassForCalendar[] } = {}): CalEvent[] {
  const events: CalEvent[] = file.kegiatan
    .filter((k) => (options.estimates || !k.perkiraan) && filter[GROUP_OF_KATEGORI[k.kategori]] && (k.audiens !== 'calon_mahasiswa' || filter.penerimaan))
    .map((k) => ({ id: k.id, group: GROUP_OF_KATEGORI[k.kategori], title: k.judul, start: k.mulai, end: k.selesai ?? k.mulai, period: STATUS_PERIOD_KATEGORI.has(k.kategori), source: { type: 'kegiatan', kegiatan: k } }));
  const holidays: CalEvent[] = filter.libur ? file.libur_nasional.map((l) => ({ id: l.id, group: 'libur', title: l.nama, start: l.mulai, end: l.selesai ?? l.mulai, period: false, source: { type: 'libur', libur: l } })) : [];
  const due: CalEvent[] = filter.tugas
    ? tasks.map((t) => ({ id: `tugas-${t.eventId}`, group: 'tugas', title: t.name, start: t.dateKey, end: t.dateKey, period: false, source: { type: 'tugas', eventId: t.eventId, courseName: t.courseName, courseColor: t.courseColor, dueAt: t.dueAt } }))
    : [];
  const classes: CalEvent[] = filter.kuliah
    ? (options.classes ?? []).map((c) => ({ id: c.id, group: 'kuliah', title: `${c.start} ${c.name}`, start: c.dateKey, end: c.dateKey, period: false, source: { type: 'kuliah', courseName: c.name, courseColor: c.courseColor, start: c.start, end: c.end, room: c.room, holiday: c.holiday } }))
    : [];
  return [...holidays, ...events, ...due, ...classes];
}

/** Events on one day, holidays first, then academic events, then tasks by due time. */
export function eventsOnDay(events: readonly CalEvent[], day: string): CalEvent[] {
  const rank = (e: CalEvent) => (e.source.type === 'libur' ? 0 : e.source.type === 'kegiatan' ? 1 : e.source.type === 'kuliah' ? 2 : 3);
  const due = (e: CalEvent) => (e.source.type === 'tugas' ? e.source.dueAt : 0);
  const time = (e: CalEvent) => (e.source.type === 'kuliah' ? e.source.start : '');
  return events.filter((e) => e.start <= day && day <= e.end).sort((a, b) => rank(a) - rank(b) || due(a) - due(b) || time(a).localeCompare(time(b)) || a.start.localeCompare(b.start));
}

/** The next `n` events starting today or later (tasks and classes left out), nearest first. */
export function upcomingEvents(events: readonly CalEvent[], today: string, n = 5): CalEvent[] {
  return events
    .filter((e) => e.source.type !== 'tugas' && e.source.type !== 'kuliah' && e.start >= today)
    .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.id.localeCompare(b.id))
    .slice(0, n);
}

/** Days that are a national holiday or joint leave day: their date number is shown in soft red. */
export function holidayDays(file: CalendarFile): Set<string> {
  const days = new Set<string>();
  for (const l of file.libur_nasional) {
    for (let d = l.mulai; d <= (l.selesai ?? l.mulai); d = addDays(d, 1)) days.add(d);
  }
  return days;
}

