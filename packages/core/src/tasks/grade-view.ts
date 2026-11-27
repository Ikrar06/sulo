// What the "Nilai" part of a task's details shows (1.1.0), for the phone and the dashboard alike. Pure.

import type { ChangeLogEntry, Task, UnixSeconds } from '../types';
import { ASSIGN_PATH, type AssignGrade } from './grade';
import type { TaskGradeOutcome } from './grade-service';

/**
 * The assignments SIKOLA has sent a grade or feedback notification about (Kabar terbaru, radar/notifications.ts):
 * their cmids, from the kept link to the assignment's page. No request: only what Sulo already logged.
 */
export function gradedCmIds(changes: readonly ChangeLogEntry[]): Set<number> {
  const out = new Set<number>();
  for (const entry of changes) {
    if (entry.change.kind !== 'grade_feedback' || !entry.change.notification.contexturl) continue;
    try {
      const url = new URL(entry.change.notification.contexturl);
      const id = url.searchParams.get('id');
      if (url.pathname === ASSIGN_PATH && id !== null && /^\d{1,10}$/.test(id)) out.add(Number(id));
    } catch {
      // A link that does not parse names no task.
    }
  }
  return out;
}

/**
 * "Lihat nilai" only for an assignment the student handed in on SIKOLA (it left SIKOLA's to-do list:
 * missingSince) that SIKOLA then sent a grade or feedback notification about. Anything else has no grade to
 * show yet, so the button would only spend a request.
 */
export function showsGradeCard(task: Task, graded: ReadonlySet<number>): boolean {
  return task.module === 'assign' && task.cmId !== null && task.missingSince !== null && graded.has(task.cmId);
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

/** A number grade in the reader's number format ("85,5 / 100", "90 (A)"); any other grade as the page wrote it. */
export function formatGrade(grade: Extract<AssignGrade, { kind: 'graded' }>, intlLocale: string): string {
  if (grade.got === null) return grade.text;
  const n = new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2 });
  return `${n.format(grade.got)}${grade.max !== null ? ` / ${n.format(grade.max)}` : ''}${grade.letter ? ` (${grade.letter})` : ''}`;
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
