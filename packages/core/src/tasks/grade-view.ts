// What the "Nilai" part of a task's details shows (1.1.0), for the phone and the dashboard alike. Pure.

import type { Task, UnixSeconds } from '../types';
import type { AssignGrade } from './grade';
import type { TaskGradeOutcome } from './grade-service';

/**
 * Only an assignment from SIKOLA that is done or past its due time: before that a grade cannot exist yet, so
 * the button would only spend a request.
 */
export function showsGradeCard(task: Task, done: boolean, now: UnixSeconds): boolean {
  return task.module === 'assign' && task.cmId !== null && (done || (task.dueAt !== null && task.dueAt <= now));
}

export type GradeLine =
  | { kind: 'value'; text: string; fetchedAt: UnixSeconds }
  | { kind: 'none'; fetchedAt: UnixSeconds }
  | { kind: 'not_shown'; fetchedAt: UnixSeconds }
  /** Sulo could not read it: the screen offers "Buka di SIKOLA". */
  | { kind: 'unknown' }
  | { kind: 'failed' }
  | { kind: 'expired' }
  | { kind: 'wait' };

/** Points as "85 / 100" in the reader's number format; any other grade as the page wrote it. */
export function formatGrade(grade: Extract<AssignGrade, { kind: 'graded' }>, intlLocale: string): string {
  if (grade.got === null || grade.max === null) return grade.text;
  const n = new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2 });
  return `${n.format(grade.got)} / ${n.format(grade.max)}`;
}

export function gradeLine(outcome: TaskGradeOutcome, intlLocale: string): GradeLine {
  switch (outcome.status) {
    case 'ok': {
      const g = outcome.grade;
      if (g.kind === 'graded') return { kind: 'value', text: formatGrade(g, intlLocale), fetchedAt: outcome.fetchedAt };
      if (g.kind === 'not_graded') return { kind: 'none', fetchedAt: outcome.fetchedAt };
      if (g.kind === 'not_shown') return { kind: 'not_shown', fetchedAt: outcome.fetchedAt };
      return { kind: 'unknown' };
    }
    case 'cooldown':
      return { kind: 'wait' };
    case 'failed':
      return outcome.reason === 'SESSION_EXPIRED' || outcome.reason === 'login_required' ? { kind: 'expired' } : { kind: 'failed' };
    default:
      // Another account's page or none named: the account check takes over; nothing is shown from it.
      return { kind: 'failed' };
  }
}
