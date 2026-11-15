// Copyable task lists (docs/UI: "Salin daftar"). No links, grades or names
// of people: only course label, task name and due date.

import type { Task, UnixSeconds } from '../types';
import { calendarDaysBetween, formatDayDateTime } from './time';

export type CopyScope = 'week' | 'all';
export type CopyFormat = 'plain' | 'whatsapp' | 'markdown';

export interface CopyItem {
  courseLabel: string;
  task: Task;
}

const TITLES: Record<CopyScope, string> = {
  week: 'Tugas minggu ini',
  all: 'Tugas yang belum dikumpulkan',
};

/** "week": overdue plus due within 7 local days. "all": every pending task. */
export function selectForCopy(items: readonly CopyItem[], scope: CopyScope, now: UnixSeconds, timeZone: string): CopyItem[] {
  const inScope =
    scope === 'all'
      ? items
      : items.filter((i) => i.task.dueAt !== null && (i.task.dueAt < now || calendarDaysBetween(now, i.task.dueAt, timeZone) < 7));
  return [...inScope].sort((a, b) => (a.task.dueAt ?? Infinity) - (b.task.dueAt ?? Infinity));
}

function line(item: CopyItem, timeZone: string): string {
  const due = item.task.dueAt === null ? 'tanpa tenggat' : formatDayDateTime(item.task.dueAt, timeZone);
  return `${item.courseLabel} - ${item.task.name} (${due})`;
}

export function formatCopyList(
  items: readonly CopyItem[],
  scope: CopyScope,
  format: CopyFormat,
  now: UnixSeconds,
  timeZone: string,
): string {
  const selected = selectForCopy(items, scope, now, timeZone);
  const title = TITLES[scope];
  if (selected.length === 0) return `${title}: tidak ada`;
  const lines = selected.map((item, i) => {
    const text = line(item, timeZone);
    return format === 'markdown' ? `- ${text}` : `${i + 1}. ${text}`;
  });
  const heading = format === 'whatsapp' ? `*${title}*` : format === 'markdown' ? `**${title}**` : title;
  const separator = format === 'markdown' ? '\n\n' : '\n';
  return `${heading}${separator}${lines.join('\n')}`;
}
