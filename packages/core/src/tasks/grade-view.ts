// What the "Nilai" part of a task's details shows (1.1.0), for the phone and the dashboard alike. Pure.

import type { ChangeLogEntry, Task, UnixSeconds } from '../types';
import { ASSIGN_PATH, type AssignGrade } from './grade';
import type { TaskGradeOutcome, TaskGrades } from './grade-service';

/**
 * The assignments Sulo knows were graded, by cmid, with no request: SIKOLA sent a grade or feedback
 * notification about them (Kabar terbaru keeps its link to the assignment's page, radar/notifications.ts), or
 * "Lihat nilai" found a grade there.
 */
export function gradedCmIds(changes: readonly ChangeLogEntry[], answers: TaskGrades = {}): Set<number> {
  const out = new Set<number>();
  for (const [cmid, entry] of Object.entries(answers)) if (entry.grade?.kind === 'graded') out.add(Number(cmid));
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
 * "Lihat nilai" for every SIKOLA assignment that is past its due time, gone from SIKOLA's list (handed in, or
 * past) or marked done (owner's decision, 27 Nov 2026): an assignment with nothing to submit online never
 * leaves the list, and a grade entered in the gradebook may send no notification, so neither can be required.
 * Before its due time a grade cannot exist yet, so the button would only spend a request.
 */
export function showsGradeCard(task: Task, done: boolean, now: UnixSeconds): boolean {
  return task.module === 'assign' && task.cmId !== null && (done || task.missingSince !== null || (task.dueAt !== null && task.dueAt <= now));
}

/**
 * What a list row shows in place of its done circle (owner's decision, 27 Nov 2026): nothing (the circle) until a
 * grade was read; then a neutral "Dinilai" while grades are hidden ("Tampilkan nilai" off, the default), the
 * value once shown, a mask in privacy mode.
 */
export type GradeBadge = { kind: 'hidden' } | { kind: 'masked' } | { kind: 'value'; text: string };

export function gradeBadge(read: Extract<AssignGrade, { kind: 'graded' }> | null, view: { gradesShown: boolean; privacyMode: boolean }, intlLocale: string): GradeBadge | null {
  if (read === null) return null;
  if (view.privacyMode) return { kind: 'masked' };
  return view.gradesShown ? { kind: 'value', text: formatGrade(read, intlLocale) } : { kind: 'hidden' };
}

/** A SIKOLA assignment Sulo knows was graded (the "Sudah dinilai" filter). */
export function isGraded(task: Task, graded: ReadonlySet<number>): boolean {
  return task.module === 'assign' && task.cmId !== null && graded.has(task.cmId);
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
