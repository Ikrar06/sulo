// Which semester's week applies today: the one running, else the next one to
// start; between semesters with no week list yet, "unavailable". Pure.

import type { CalendarFile, Semester } from './schema.ts';
import { weekOf, type WeekInfo } from './weeks.ts';

export interface CurrentWeek {
  semester: Semester | null;
  info: WeekInfo;
}

export function currentWeek(file: CalendarFile, today: string): CurrentWeek {
  const awal = weekOf(file.pekan.awal, today);
  if (awal.kind === 'week' || awal.kind === 'excluded' || awal.kind === 'before') return { semester: 'awal', info: awal };
  const akhir = weekOf(file.pekan.akhir, today);
  if (akhir.kind !== 'after' && today <= file.berlaku_sampai) return { semester: 'akhir', info: akhir };
  return { semester: null, info: { kind: 'after' } };
}
