import { calendarDaysBetween } from '../format/time';
import type { CourseId, Task, UnixSeconds } from '../types';
import type { TaskStateMap } from './local-state';
import { getTaskState } from './local-state';
import { followsTask } from './own';

export type TaskGroupKey = 'overdue' | 'soon' | 'week' | 'later' | 'undated';

export const GROUP_ORDER: readonly TaskGroupKey[] = ['overdue', 'soon', 'week', 'later', 'undated'];

export type Urgency = 'overdue' | 'day' | 'threeDays' | 'normal';

const HOUR = 3600;

/** Tasks waiting for the user: active course, still in the calendar, not marked done. */
export function pendingTasks(
  tasks: readonly Task[],
  state: TaskStateMap,
  activeCourseIds: ReadonlySet<CourseId>,
): Task[] {
  return tasks.filter(
    (t) => t.missingSince === null && followsTask(activeCourseIds, t) && !getTaskState(state, t.eventId).doneManually,
  );
}

/**
 * Groups by local calendar day: overdue, today and tomorrow, within 7 days,
 * later, and no due date. Each group is sorted by due time.
 */
export function groupTasks(tasks: readonly Task[], now: UnixSeconds, timeZone: string): Record<TaskGroupKey, Task[]> {
  const groups: Record<TaskGroupKey, Task[]> = { overdue: [], soon: [], week: [], later: [], undated: [] };
  for (const t of tasks) {
    if (t.dueAt === null) groups.undated.push(t);
    else if (t.dueAt < now) groups.overdue.push(t);
    else {
      const days = calendarDaysBetween(now, t.dueAt, timeZone);
      if (days <= 1) groups.soon.push(t);
      else if (days < 7) groups.week.push(t);
      else groups.later.push(t);
    }
  }
  const byDue = (a: Task, b: Task) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) || a.name.localeCompare(b.name);
  for (const key of GROUP_ORDER) groups[key].sort(byDue);
  return groups;
}

/** Urgency for the dot and the remaining-time text (never the only cue). */
export function urgencyOf(dueAt: UnixSeconds | null, now: UnixSeconds): Urgency {
  if (dueAt === null) return 'normal';
  if (dueAt < now) return 'overdue';
  if (dueAt - now < 24 * HOUR) return 'day';
  if (dueAt - now < 72 * HOUR) return 'threeDays';
  return 'normal';
}

/** Tasks that count towards the badge: overdue plus due within 24 hours. */
export function badgeCount(tasks: readonly Task[], now: UnixSeconds): number {
  return tasks.filter((t) => t.dueAt !== null && t.dueAt - now < 24 * HOUR).length;
}
