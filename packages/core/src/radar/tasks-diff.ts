// New tasks and changed due dates from the calendar (no extra request). Pure.
// The first calendar sync after the radar starts is a silent baseline.

import type { Change, Task } from '../types';

export function diffTasks(previous: readonly Task[], next: readonly Task[], baseline: boolean): Change[] {
  if (baseline) return [];
  const before = new Map(previous.map((t) => [t.eventId, t]));
  const changes: Change[] = [];
  for (const t of next) {
    if (t.missingSince !== null) continue;
    const old = before.get(t.eventId);
    if (!old) {
      changes.push({ kind: 'task_added', courseId: t.courseId, eventId: t.eventId, cmId: t.cmId, name: t.name, dueAt: t.dueAt, url: t.url });
    } else if (old.dueAt !== t.dueAt) {
      changes.push({ kind: 'due_changed', courseId: t.courseId, eventId: t.eventId, cmId: t.cmId, name: t.name, from: old.dueAt, to: t.dueAt, url: t.url });
    }
  }
  return changes;
}
