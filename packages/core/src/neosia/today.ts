// "Kuliah hari ini" on the overview (M7.1): today's classes from the NEOSIA
// schedule, without the ones already over, and none on an academic-calendar
// holiday. Pure; times are local "HH:MM" and minutes of the local day.

import { addDays, weekday } from '../calendar/dates.ts';
import { holidayOn } from './schedule';
import type { ClassMeeting } from './view';

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export function classesToday<M extends Pick<ClassMeeting, 'weekday' | 'start' | 'end'>>(meetings: readonly M[], today: string, minuteOfDay: number, holidays: readonly { mulai: string; selesai: string; nama: string }[]): M[] {
  if (holidayOn(holidays, today) !== null) return [];
  const wd = weekday(today);
  return meetings.filter((m) => m.weekday === wd && minutes(m.end) > minuteOfDay).sort((a, b) => a.start.localeCompare(b.start));
}

/** Days ahead to look for the next class. */
const NEXT_CLASS_DAYS = 21;

/**
 * "Kuliah berikutnya": the nearest class after now, today's later ones
 * first, skipping academic-calendar holidays. null when none within 3 weeks.
 */
export function nextClass<M extends ClassMeeting>(meetings: readonly M[], today: string, minuteOfDay: number, holidays: readonly { mulai: string; selesai: string; nama: string }[]): { meeting: M; day: string } | null {
  for (let i = 0; i <= NEXT_CLASS_DAYS; i++) {
    const day = addDays(today, i);
    if (holidayOn(holidays, day) !== null) continue;
    const wd = weekday(day);
    const found = meetings
      .filter((m) => m.weekday === wd && (i > 0 || minutes(m.start) > minuteOfDay))
      .sort((a, b) => a.start.localeCompare(b.start))[0];
    if (found) return { meeting: found, day };
  }
  return null;
}
