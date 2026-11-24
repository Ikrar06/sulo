// "Sehari bareng Sulo": the two lock-screen notifications of the day, worded
// by the apps' own dictionary (packages/core/src/i18n notify) from the same
// sample data as every screen: the morning summary at 06.30 and a deadline
// reminder at 21.00 on Wednesday 25 November 2026 (WITA).
import { buildTaskItems } from '@sulo/core/dashboard/tasks';
import { formatClock, formatLeft } from '@sulo/core/format/time';
import { messagesFor } from '@sulo/core/i18n';
import { morningCounts, morningFullView } from '@sulo/core/reminders/morning';
import { localParts } from '@sulo/core/reminders/zoned';
import type { DashboardData } from '@sulo/core/view/dashboard-data';
import { ZONA } from './contoh';
import type { Bahasa } from '../teks';

export interface Notifikasi {
  judul: string;
  isi: string;
}

/** A moment of the sample day (minutes after midnight, WITA) as unix seconds. */
export function pukul(data: DashboardData, menit: number): number {
  const tengahMalam = data.now - localParts(data.now, ZONA).minuteOfDay * 60 - (data.now % 60);
  return tengahMalam + menit * 60;
}

/** The phone's morning summary at 06.30, by the app's own functions (reminders/morning.ts): late, due today, due tomorrow, today's events. */
export function ringkasanPagi(data: DashboardData, bahasa: Bahasa): Notifikasi {
  const m = messagesFor(bahasa);
  const at = pukul(data, 6 * 60 + 30);
  const pending = buildTaskItems(data.user!)
    .filter((i) => i.status === 'pending' && i.task.dueAt !== null)
    .map((i) => i.task);
  const c = morningCounts(at, ZONA, pending, data.calendar.kegiatan);
  if (!c) return { judul: m.notify.morningFullTitle, isi: '' };
  const v = morningFullView(c, m);
  return { judul: v.title, isi: v.message };
}

/** The evening reminder at 21.00: the nearest deadline tomorrow (the moment says "tomorrow's deadline"), or the nearest ahead. */
export function pengingatMalam(data: DashboardData, bahasa: Bahasa): Notifikasi {
  const m = messagesFor(bahasa);
  const at = pukul(data, 21 * 60);
  const besok = localParts(at + 86_400, ZONA).dateKey;
  const depan = buildTaskItems(data.user!)
    .filter((i) => i.status === 'pending' && i.task.dueAt !== null && i.task.dueAt > at)
    .sort((a, b) => a.task.dueAt! - b.task.dueAt!);
  const next = depan.find((i) => localParts(i.task.dueAt!, ZONA).dateKey === besok) ?? depan[0];
  if (!next) return { judul: m.notify.morningFullTitle, isi: '' };
  return {
    judul: m.notify.taskTitle(next.task.name, formatLeft(next.task.dueAt!, at, ZONA, m)),
    isi: m.notify.taskBody(next.courseName, formatClock(next.task.dueAt!, ZONA, m)),
  };
}

/** The clock as the phone shows it in each language: 06.30 in Indonesian, 06:30 in English. */
export const jamHp = (jam: string, bahasa: Bahasa) => (bahasa === 'en' ? jam.replace('.', ':') : jam);

/** "Rabu, 25 November" or "Wednesday 25 November", for a lock screen. */
export function tanggalKunci(data: DashboardData, bahasa: Bahasa): string {
  return new Intl.DateTimeFormat(bahasa === 'en' ? 'en-GB' : 'id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONA }).format(new Date(data.now * 1000));
}
