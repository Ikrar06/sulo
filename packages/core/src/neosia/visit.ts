// When the phone's "Perbarui NEOSIA otomatis" visit is due (1.1.0): only
// when the app is opened, only with the user's consent and while the config
// allows it (sources.neosia.scheduledVisit). Once a day while NEOSIA's data
// actually changes (the KRS window and the grade-entry period of Sulo's
// academic calendar), once a week otherwise. Pure.

import type { Kegiatan } from '../calendar/schema';

export const VISIT_KEY = 'neosia:lastVisitAt';
const DAY = 86_400;
/** A due visit may run a little early (the app is opened at slightly different times each day). */
const SLACK = 2 * 3600;

/** Today is inside a KRS window or a grade-entry period of the calendar. */
export function busyPeriod(kegiatan: readonly Kegiatan[], today: string): boolean {
  return kegiatan.some((k) => (k.kategori === 'krs' || k.kategori === 'nilai') && k.mulai <= today && (k.selesai ?? k.mulai) >= today);
}

export interface VisitInput {
  consented: boolean;
  configAllows: boolean;
  moduleOn: boolean;
  lastVisitAt: number | null;
  now: number;
  today: string;
  kegiatan: readonly Kegiatan[];
}

export function visitDue(i: VisitInput): boolean {
  if (!i.consented || !i.configAllows || !i.moduleOn) return false;
  if (i.lastVisitAt === null) return true;
  const gap = busyPeriod(i.kegiatan, i.today) ? DAY : 7 * DAY;
  return i.now - i.lastVisitAt >= gap - SLACK;
}
