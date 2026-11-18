// Activity types that carry a deadline and so count as tasks, never as
// "materi baru". Matched on the module code (`modname`), never on its
// translated name. Pure.

import type { Change } from '../types';

/**
 * assign (Tugas), quiz (Kuis), workshop, lesson, scorm and h5pactivity: the
 * Moodle activities whose due or close date shows up in the calendar's
 * action events. Forums, choices and feedback can have dates too but are
 * not tasks to hand in.
 */
export const TASK_MODULES: ReadonlySet<string> = new Set(['assign', 'quiz', 'workshop', 'lesson', 'scorm', 'h5pactivity']);

/** A new or newly shown activity of a task type. */
export function isNewTaskActivity(change: Change): boolean {
  return (change.kind === 'added' || change.kind === 'shown') && TASK_MODULES.has(change.module);
}
