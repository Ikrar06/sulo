// Tasks the student adds (1.1.0, from a user's suggestion, 27 Nov 2026): work given outside SIKOLA, such as
// a presentation or a project, with an optional course and due time. Kept per account beside SIKOLA's tasks
// (u:{id}:ownTasks), never sent anywhere, and never read by sync or Radar: they join the task list only where
// views (storage.ts readAllUser) and reminders (reminders/run.ts, morning.ts) are built, as ordinary tasks of
// module "own". Their steps, note and "done" are the same local state as any task's. Pure.

import type { CourseId, Task, UnixSeconds } from '../types';

/** The module code an added task carries, never a Moodle one. */
export const OWN_MODULE = 'own';
export const OWN_TITLE_MAX = 120;
/** The course id an added task without a course shows under (no SIKOLA course has it). */
export const NO_COURSE: CourseId = 0 as CourseId;

export interface OwnTask {
  /** Negative and never reused, so it never meets a SIKOLA event id nor an old task's notes or reminders. */
  id: number;
  title: string;
  courseId: CourseId | null;
  dueAt: UnixSeconds | null;
  createdAt: UnixSeconds;
}

export interface OwnTaskInput {
  title: string;
  courseId: CourseId | null;
  dueAt: UnixSeconds | null;
}

export const isOwnTask = (t: Pick<Task, 'module'>): boolean => t.module === OWN_MODULE;

/** Whether a task counts (lists, reminders, the morning summary): its course is followed, or the student added it. */
export const followsTask = (active: ReadonlySet<CourseId>, t: Pick<Task, 'module' | 'courseId'>): boolean => isOwnTask(t) || active.has(t.courseId);

/** The title as stored: trimmed, single spaces, at most OWN_TITLE_MAX; null when nothing is left. */
export function cleanTitle(raw: string): string | null {
  const title = raw.replace(/\s+/g, ' ').trim().slice(0, OWN_TITLE_MAX).trim();
  return title === '' ? null : title;
}

export function ownAsTask(o: OwnTask): Task {
  return {
    eventId: o.id,
    cmId: null,
    courseId: o.courseId ?? NO_COURSE,
    name: o.title,
    module: OWN_MODULE,
    dueAt: o.dueAt,
    url: '',
    overdue: false,
    firstSeenAt: o.createdAt,
    lastSeenAt: o.createdAt,
    missingSince: null,
  };
}

/** SIKOLA's tasks and the added ones, for a view or the reminders. */
export function withOwnTasks(tasks: readonly Task[], own: readonly OwnTask[] | undefined): Task[] {
  return own && own.length > 0 ? [...tasks, ...own.map(ownAsTask)] : [...tasks];
}

/** A new id from the time (a hundred a second), below every id in the list. */
export function nextOwnId(list: readonly OwnTask[], now: UnixSeconds): number {
  const fromTime = -(now * 100);
  const lowest = list.reduce((min, o) => Math.min(min, o.id), 0);
  return Math.min(fromTime, lowest - 1);
}

/** The list with one more task; unchanged when the title is empty. */
export function addOwnTask(list: readonly OwnTask[], input: OwnTaskInput, now: UnixSeconds): OwnTask[] {
  const title = cleanTitle(input.title);
  if (title === null) return [...list];
  return [...list, { id: nextOwnId(list, now), title, courseId: input.courseId, dueAt: input.dueAt, createdAt: now }];
}

/** The list with one task changed; an empty title leaves the old one. */
export function updateOwnTask(list: readonly OwnTask[], id: number, input: OwnTaskInput): OwnTask[] {
  return list.map((o) => (o.id === id ? { ...o, title: cleanTitle(input.title) ?? o.title, courseId: input.courseId, dueAt: input.dueAt } : o));
}

export function removeOwnTask(list: readonly OwnTask[], id: number): OwnTask[] {
  return list.filter((o) => o.id !== id);
}
