// Month and list views of the academic calendar plus task deadlines. Pure;
// dates are local YYYY-MM-DD keys, weeks start on Monday.

import { addDays, weekday } from './dates.ts';
import type { CalendarFile, Kategori, Kegiatan, Libur } from './schema.ts';

export type CalendarItem =
  | { type: 'kegiatan'; kegiatan: Kegiatan }
  | { type: 'libur'; libur: Libur }
  | { type: 'tugas'; eventId: number; name: string; courseName: string; courseColor: number; dateKey: string };

export interface CalendarFilter {
  /** null: every category. */
  kategori: Kategori | null;
  /** Admissions are hidden unless asked for. */
  applicants: boolean;
  tasks: boolean;
  holidays: boolean;
}

export const DEFAULT_CALENDAR_FILTER: CalendarFilter = { kategori: null, applicants: false, tasks: true, holidays: true };

/** "2026-11" -> the Monday-to-Sunday weeks that cover the month (5 or 6 rows). */
export function monthGrid(month: string): string[][] {
  const first = `${month}-01`;
  const start = addDays(first, -((weekday(first) + 6) % 7));
  const weeks: string[][] = [];
  for (let monday = start; monday.slice(0, 7) <= month || weeks.length === 0; monday = addDays(monday, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(monday, i)));
    if (weeks.length > 6) break;
  }
  return weeks;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

const covers = (mulai: string, selesai: string | null, day: string) => mulai <= day && (selesai === null ? day === mulai : day <= selesai);

export function visibleKegiatan(file: CalendarFile, filter: CalendarFilter): Kegiatan[] {
  return file.kegiatan.filter((k) => (filter.applicants || k.audiens !== 'calon_mahasiswa') && (filter.kategori === null || k.kategori === filter.kategori));
}

/** Everything on one day: holidays first, then academic events, then task deadlines. */
export function itemsOnDay(
  day: string,
  file: CalendarFile,
  filter: CalendarFilter,
  tasks: readonly Extract<CalendarItem, { type: 'tugas' }>[],
): CalendarItem[] {
  const holidays = filter.holidays && filter.kategori === null ? file.libur_nasional.filter((l) => covers(l.mulai, l.selesai, day)).map((libur): CalendarItem => ({ type: 'libur', libur })) : [];
  // Month-level estimates span whole months; they would fill every cell, so the month view leaves them to the list.
  const events = visibleKegiatan(file, filter)
    .filter((k) => !k.perkiraan && covers(k.mulai, k.selesai, day))
    .map((kegiatan): CalendarItem => ({ type: 'kegiatan', kegiatan }));
  const due = filter.tasks && filter.kategori === null ? tasks.filter((t) => t.dateKey === day) : [];
  return [...holidays, ...events, ...due];
}

/** Whether a study evaluation's details mention the user's intake year. */
export function mentionsAngkatan(k: Pick<Kegiatan, 'rincian'>, year: number | null): boolean {
  if (year === null) return false;
  const pattern = new RegExp(`Angkatan\\s+${year}(?!\\d)`, 'i');
  return k.rincian.some((r) => pattern.test(r));
}

/** List view: events grouped by the month they start in, in order. */
export function groupByMonth(events: readonly Kegiatan[]): { month: string; events: Kegiatan[] }[] {
  const groups = new Map<string, Kegiatan[]>();
  for (const k of [...events].sort((a, b) => a.mulai.localeCompare(b.mulai) || a.id.localeCompare(b.id))) {
    const month = k.mulai.slice(0, 7);
    groups.set(month, [...(groups.get(month) ?? []), k]);
  }
  return [...groups.entries()].map(([month, list]) => ({ month, events: list }));
}
