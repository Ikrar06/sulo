// Copyable task lists ("Salin daftar"). One format: plain text that reads
// well when pasted into WhatsApp (no asterisks, no Markdown). No links,
// grades or names of people: only course name, task name and due date.
// Times are always the due date and time, never a countdown.

import { id, type Messages } from '../i18n/id';
import type { Task, UnixSeconds } from '../types';
import { calendarDaysBetween, formatDayDateTime } from './time';

export type CopyScope = 'week' | 'all';

export interface CopyItem {
  /** Course name without class letter, e.g. "Mekanika Fluida". */
  courseName: string;
  task: Task;
}

/** "week": overdue plus due within 7 local days. "all": every pending task. */
export function selectForCopy(items: readonly CopyItem[], scope: CopyScope, now: UnixSeconds, timeZone: string): CopyItem[] {
  const inScope =
    scope === 'all'
      ? items
      : items.filter((i) => i.task.dueAt !== null && (i.task.dueAt < now || calendarDaysBetween(now, i.task.dueAt, timeZone) < 7));
  return [...inScope].sort((a, b) => (a.task.dueAt ?? Infinity) - (b.task.dueAt ?? Infinity));
}

export function formatCopyList(items: readonly CopyItem[], scope: CopyScope, now: UnixSeconds, timeZone: string, m: Messages = id): string {
  const c = m.popup.copy;
  const title = scope === 'week' ? c.weekHeading : c.allHeading;
  const selected = selectForCopy(items, scope, now, timeZone);
  if (selected.length === 0) return `${title}: ${c.none}`;
  const lines = selected.map(({ courseName, task }, i) => {
    const due = task.dueAt === null ? c.noDue : formatDayDateTime(task.dueAt, timeZone, m);
    return `${i + 1}. ${courseName} - ${task.name} (${due})`;
  });
  return [title, ...lines].join('\n');
}
