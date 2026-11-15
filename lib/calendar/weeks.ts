// Teaching week number from the explicit week list. Pure. Never computed
// from a start date alone: holidays may shift the count, so the list in the
// data file is the source of truth. A null list means "not available yet".

import { addDays } from './dates.ts';
import type { PekanSemester } from './schema.ts';

export type WeekInfo =
  | { kind: 'unavailable' }
  | { kind: 'before'; startsOn: string }
  | { kind: 'week'; nomor: number; total: number; uts: boolean; uas: boolean }
  | { kind: 'excluded'; alasan: string }
  | { kind: 'after' };

export function weekOf(pekan: PekanSemester | null, today: string): WeekInfo {
  if (!pekan || pekan.pekan.length === 0) return { kind: 'unavailable' };
  const first = pekan.pekan[0]!;
  if (today < first.mulai) return { kind: 'before', startsOn: first.mulai };
  const inWeek = (monday: string) => today >= monday && today <= addDays(monday, 6);
  const week = pekan.pekan.find((p) => inWeek(p.mulai));
  if (week) {
    return { kind: 'week', nomor: week.nomor, total: pekan.pekan.length, uts: week.nomor === pekan.uts_pekan, uas: week.nomor === pekan.uas_pekan };
  }
  const excluded = pekan.dikecualikan.find((d) => inWeek(d.mulai));
  if (excluded) return { kind: 'excluded', alasan: excluded.alasan };
  return { kind: 'after' };
}
