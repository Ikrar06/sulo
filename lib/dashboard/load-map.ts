// "Peta beban": the next 14 local days, each with its due tasks and academic
// calendar events, and a level 0..4 for the cell's intensity. Pure.

import { localParts, addDays } from '../reminders/zoned';
import type { Kegiatan } from '../calendar/schema';
import type { Task, UnixSeconds } from '../types';

export interface LoadDay {
  dateKey: string;
  tasks: Task[];
  /** Calendar events running on this day (exams, breaks, deadlines). */
  events: Pick<Kegiatan, 'id' | 'judul' | 'kategori'>[];
  /** 0 empty .. 4 heaviest. An exam day is at least 3. */
  level: 0 | 1 | 2 | 3 | 4;
}

const HEAVY: ReadonlySet<string> = new Set(['uts', 'uas']);

export function levelOf(taskCount: number, exam: boolean): LoadDay['level'] {
  const base = taskCount === 0 ? 0 : taskCount === 1 ? 1 : taskCount <= 3 ? 2 : taskCount <= 5 ? 3 : 4;
  return (exam ? Math.max(base, 3) : base) as LoadDay['level'];
}

export function loadMap(
  pendingTasks: readonly Task[],
  events: readonly Pick<Kegiatan, 'id' | 'judul' | 'kategori' | 'mulai' | 'selesai' | 'perkiraan' | 'audiens'>[],
  now: UnixSeconds,
  timeZone: string,
  days = 14,
): LoadDay[] {
  const today = localParts(now, timeZone).dateKey;
  return Array.from({ length: days }, (_, i) => {
    const dateKey = addDays(today, i);
    const tasks = pendingTasks.filter((t) => t.dueAt !== null && localParts(t.dueAt, timeZone).dateKey === dateKey);
    const dayEvents = events.filter((e) => !e.perkiraan && e.audiens !== 'calon_mahasiswa' && e.mulai <= dateKey && (e.selesai === null ? e.mulai === dateKey : dateKey <= e.selesai));
    return {
      dateKey,
      tasks,
      events: dayEvents.map(({ id, judul, kategori }) => ({ id, judul, kategori })),
      level: levelOf(tasks.length, dayEvents.some((e) => HEAVY.has(e.kategori))),
    };
  });
}
