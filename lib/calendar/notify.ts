// Academic calendar reminders (M5a). Pure: which events notify, on which
// days, under which unique key. The reminder planner (lib/reminders/plan.ts)
// sends them through the same engine as task reminders: keys recorded before
// showing, never twice, quiet hours respected.
//
// - H-7 only for KRS, UKT and UAS.
// - H-1 for KRS, UKT, UTS, UAS, the drop/swap deadline, the withdrawal
//   deadline and grade appeals.
// - Windows that last several days (KRS, UKT, appeals) are also reminded the
//   day before their last day. Exam weeks are not: "UAS ends tomorrow" helps
//   nobody plan.
// - Month-level estimates and admissions never notify.
// - A reminder is sent only on its own day; one missed while the browser was
//   closed is dropped (a "tomorrow" note after the day has passed is wrong).

import { addDays } from './dates.ts';
import type { CalendarNotifyKind, CalendarNotifySettings } from './notify-settings.ts';
import type { Kegiatan } from './schema.ts';

export type CalendarStage = 'h7' | 'h1' | 'h1-akhir';

/** What a notice needs about the event; nothing else leaves the calendar file. */
export type CalendarEventLite = Pick<Kegiatan, 'id' | 'judul' | 'mulai' | 'selesai' | 'kategori' | 'perkiraan' | 'audiens'>;

export interface CalendarReminder {
  key: string;
  stage: CalendarStage;
  kind: CalendarNotifyKind;
  event: CalendarEventLite;
  /** Local date the reminder belongs to. */
  day: string;
}

const H7: ReadonlySet<CalendarNotifyKind> = new Set(['krs', 'ukt', 'uas']);
/** Windows whose last day is itself a deadline. */
const END_REMINDED: ReadonlySet<CalendarNotifyKind> = new Set(['krs', 'ukt', 'sanggah', 'pembatalan', 'pengunduran']);

export function notifyKindOf(event: CalendarEventLite): CalendarNotifyKind | null {
  if (event.perkiraan || event.audiens === 'calon_mahasiswa') return null;
  switch (event.kategori) {
    case 'krs':
      return 'krs';
    case 'uts':
      return 'uts';
    case 'uas':
      return 'uas';
    case 'sanggah':
      return 'sanggah';
  }
  if (/pembayaran ukt/i.test(event.judul)) return 'ukt';
  if (/pembatalan|penggantian mata kuliah/i.test(event.judul)) return 'pembatalan';
  if (/pengunduran diri/i.test(event.judul)) return 'pengunduran';
  return null;
}

export const calendarKey = (event: CalendarEventLite, stage: CalendarStage, day: string) => `k:${event.id}:${stage}:${day}`;

/** Every reminder the events can produce, for the kinds turned on. */
export function calendarReminders(events: readonly CalendarEventLite[], settings: CalendarNotifySettings): CalendarReminder[] {
  return events.flatMap((event) => {
    const kind = notifyKindOf(event);
    if (kind === null || !settings[kind]) return [];
    const out: CalendarReminder[] = [];
    const add = (stage: CalendarStage, day: string) => out.push({ key: calendarKey(event, stage, day), stage, kind, event, day });
    if (H7.has(kind)) add('h7', addDays(event.mulai, -7));
    add('h1', addDays(event.mulai, -1));
    if (END_REMINDED.has(kind) && event.selesai !== null && event.selesai > event.mulai) {
      const day = addDays(event.selesai, -1);
      if (day > addDays(event.mulai, -1)) add('h1-akhir', day);
    }
    return out;
  });
}
