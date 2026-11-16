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

/** Limits for local notes, so a stray paste cannot bloat storage. */
export const NOTE_MAX = 2000;
export const STEP_MAX = 200;
export const STEPS_MAX = 30;

const patch = (map: TaskStateMap, eventId: number, change: Partial<TaskLocalState>): TaskStateMap => ({
  ...map,
  [String(eventId)]: { ...getTaskState(map, eventId), ...change },
});

/** A personal due date for a task SIKOLA gives none; null removes it. */
export function setCustomDue(map: TaskStateMap, eventId: number, at: UnixSeconds | null): TaskStateMap {
  return patch(map, eventId, { customDueAt: at });
}

export function setNote(map: TaskStateMap, eventId: number, note: string): TaskStateMap {
  return patch(map, eventId, { note: note.slice(0, NOTE_MAX) });
}

/** Adds a checklist step; blank text is ignored. `id` is injected (tests stay deterministic). */
export function addStep(map: TaskStateMap, eventId: number, text: string, id: string): TaskStateMap {
  const clean = text.trim().slice(0, STEP_MAX);
  const steps = getTaskState(map, eventId).steps;
  if (!clean || steps.length >= STEPS_MAX) return map;
  return patch(map, eventId, { steps: [...steps, { id, text: clean, done: false }] });
}

export function toggleStep(map: TaskStateMap, eventId: number, stepId: string): TaskStateMap {
  return patch(map, eventId, { steps: getTaskState(map, eventId).steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s)) });
}

export function removeStep(map: TaskStateMap, eventId: number, stepId: string): TaskStateMap {
  return patch(map, eventId, { steps: getTaskState(map, eventId).steps.filter((s) => s.id !== stepId) });
}

/** Drops state for tasks that no longer exist, keeping storage small. */
export function pruneTaskState(map: TaskStateMap, existingEventIds: ReadonlySet<number>): TaskStateMap {
  return Object.fromEntries(Object.entries(map).filter(([id]) => existingEventIds.has(Number(id))));
}
