// A personal due date (dashboard) stands in for a missing SIKOLA due date:
// the task is grouped, reminded and shown by it, marked as personal. A task
// that has a real due date always keeps it. Pure.

import type { Task } from '../types';
import type { TaskStateMap } from './local-state';

export interface WithPersonalDue {
  tasks: Task[];
  /** Event ids whose due date is the personal one. */
  personal: Set<number>;
}

export function applyPersonalDue(tasks: readonly Task[], state: TaskStateMap): WithPersonalDue {
  const personal = new Set<number>();
  const out = tasks.map((t) => {
    const custom = state[String(t.eventId)]?.customDueAt ?? null;
    if (t.dueAt !== null || custom === null) return t;
    personal.add(t.eventId);
    return { ...t, dueAt: custom };
  });
  return { tasks: out, personal };
}
