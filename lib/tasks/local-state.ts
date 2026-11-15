import type { TaskLocalState, UnixSeconds } from '../types';

export type TaskStateMap = Readonly<Record<string, TaskLocalState>>;

const empty = (eventId: number): TaskLocalState => ({
  eventId,
  doneManually: false,
  snoozedUntil: null,
  steps: [],
  note: '',
});

export function getTaskState(map: TaskStateMap, eventId: number): TaskLocalState {
  return map[String(eventId)] ?? empty(eventId);
}

export function setDone(map: TaskStateMap, eventId: number, done: boolean): TaskStateMap {
  return { ...map, [String(eventId)]: { ...getTaskState(map, eventId), doneManually: done } };
}

/** Snooze data is stored now; the reminders that use it arrive in M3. */
export function setSnooze(map: TaskStateMap, eventId: number, until: UnixSeconds | null): TaskStateMap {
  return { ...map, [String(eventId)]: { ...getTaskState(map, eventId), snoozedUntil: until } };
}

/** Drops state for tasks that no longer exist, keeping storage small. */
export function pruneTaskState(map: TaskStateMap, existingEventIds: ReadonlySet<number>): TaskStateMap {
  return Object.fromEntries(Object.entries(map).filter(([id]) => existingEventIds.has(Number(id))));
}
