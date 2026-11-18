// "Kuliah hari ini" on the overview (M7.1): today's classes from the NEOSIA
// schedule, without the ones already over, and none on an academic-calendar
// holiday. Pure; times are local "HH:MM" and minutes of the local day.

import { weekday } from '../calendar/dates.ts';
import { holidayOn } from './schedule';
import type { ClassMeeting } from './view';

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export function classesToday<M extends ClassMeeting>(meetings: readonly M[], today: string, minuteOfDay: number, holidays: readonly { mulai: string; selesai: string; nama: string }[]): M[] {
  if (holidayOn(holidays, today) !== null) return [];
  const wd = weekday(today);
  return meetings.filter((m) => m.weekday === wd && minutes(m.end) > minuteOfDay).sort((a, b) => a.start.localeCompare(b.start));
}
