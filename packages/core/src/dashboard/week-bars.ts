// The phone's "7 hari ke depan" card: one column per local day from today,
// each with its due count, a bar height scaled to the busiest day, and an
// optional category dot for an exam or an important date. Pure; the
// extension keeps its 14-day map (load-map.ts).

import { GROUP_OF_KATEGORI, STATUS_PERIOD_KATEGORI, type CalendarGroup } from '../calendar/groups';
import type { Kegiatan } from '../calendar/schema';
import type { Task, UnixSeconds } from '../types';
import { loadMap } from './load-map';

export const WEEK_BAR_DAYS = 7;
/** Bar height in px: the busiest day reaches the max, an empty day keeps the muted baseline. */
export const WEEK_BAR_MAX = 48;
export const WEEK_BAR_MIN = 4;

export interface WeekBar {
  dateKey: string;
  count: number;
  height: number;
  /** The dot under the date: an exam first, else an event starting or ending that day. */
  dot: CalendarGroup | null;
  isToday: boolean;
}

type BarEvent = Pick<Kegiatan, 'id' | 'judul' | 'kategori' | 'mulai' | 'selesai' | 'perkiraan' | 'audiens'>;

/** Long periods (breaks, KKN, admissions) never dot a day; exams always do; others only on their first or last day. */
export function dotOf(events: readonly BarEvent[], dateKey: string): CalendarGroup | null {
  const marked = events.filter((e) => !STATUS_PERIOD_KATEGORI.has(e.kategori));
  if (marked.some((e) => GROUP_OF_KATEGORI[e.kategori] === 'ujian')) return 'ujian';
  const edge = marked.find((e) => e.mulai === dateKey || (e.selesai ?? e.mulai) === dateKey);
  return edge ? GROUP_OF_KATEGORI[edge.kategori] : null;
}

export function barHeight(count: number, busiest: number): number {
  if (count <= 0 || busiest <= 0) return WEEK_BAR_MIN;
  return Math.max(WEEK_BAR_MIN, Math.round((WEEK_BAR_MAX * count) / busiest));
}

export function weekBars(pendingTasks: readonly Task[], events: readonly BarEvent[], now: UnixSeconds, timeZone: string): WeekBar[] {
  const days = loadMap(pendingTasks, events, now, timeZone, WEEK_BAR_DAYS);
  const busiest = Math.max(0, ...days.map((d) => d.tasks.length));
  return days.map((d, i) => {
    const running = events.filter((e) => d.events.some((x) => x.id === e.id));
    return { dateKey: d.dateKey, count: d.tasks.length, height: barHeight(d.tasks.length, busiest), dot: dotOf(running, d.dateKey), isToday: i === 0 };
  });
}
