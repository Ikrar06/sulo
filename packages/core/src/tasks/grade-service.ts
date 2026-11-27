// "Lihat nilai" (1.1.0): one GET of a task's assignment page, only when the student taps it, through the
// same client as everything else (allowlist, budget, queue, backoff). The answer is kept per account while its
// task is kept (the "Sudah dinilai" filter, at most TASK_GRADES_MAX); a look within 24 hours of the last read
// (HTML_ON_DEMAND_TTL_H) asks nothing, and "Cek lagi" asks again after 2 minutes at the soonest.
// Only for one of the student's own SIKOLA assignments past its due time, gone from SIKOLA's list or marked done
// (tasks/grade-view.ts showsGradeCard), checked here too. A page that answers for another
// account is never stored (the same check as attendance). The grade stays on this device: never in a
// notification, a copied list, a calendar file or a bug report.

import { ACCOUNT_PENDING_KEY, newPending } from '../account/pending';
import type { MoodleClient } from '../moodle/client';
import { HTML_ON_DEMAND_TTL_H } from '../moodle/limits';
import { readSession } from '../moodle/session';
import { pageUserId } from '../presensi/page-user';
import { currentUser, readUser, writeUserIfCurrent } from '../storage';
import type { Clock, KeyValueStore, UnixSeconds, UserId } from '../types';
import { assignViewPath, parseAssignGrade, type AssignGrade } from './grade';
import { getTaskState } from './local-state';
import { showsGradeCard } from './grade-view';

export const TASK_GRADE_CACHE_SEC = HTML_ON_DEMAND_TTL_H * 3600;
export const TASK_GRADE_COOLDOWN_SEC = 120;
/** Answers kept per account, newest first (a semester's assignments). */
export const TASK_GRADES_MAX = 200;

export interface TaskGradeEntry {
  /** When the page was last read; null while every request so far failed. */
  fetchedAt: UnixSeconds | null;
  /** The last request, for the 2-minute wait. */
  requestAt: UnixSeconds;
  grade: AssignGrade | null;
}

/** Keyed by the assignment's cmid. */
export type TaskGrades = Record<string, TaskGradeEntry>;

export type TaskGradeOutcome =
  | { status: 'ok'; grade: AssignGrade; fetchedAt: UnixSeconds; cached: boolean }
  | { status: 'cooldown'; retryAt: UnixSeconds }
  /** NO_ACCOUNT, SESSION_EXPIRED, NOT_A_TASK, a client refusal (budget, backoff) or a transport failure. */
  | { status: 'failed'; reason: string }
  | { status: 'account_mismatch' }
  | { status: 'user_unverified' };

export interface TaskGradeDeps {
  client: MoodleClient;
  store: KeyValueStore;
  clock: Clock;
}

/** Only answers for tasks still kept (`cmids`, when given), the newest TASK_GRADES_MAX by their last request. */
export function pruneGrades(grades: TaskGrades, cmids?: ReadonlySet<number>): TaskGrades {
  const entries = Object.entries(grades).filter(([cmid]) => !cmids || cmids.has(Number(cmid)));
  if (entries.length <= TASK_GRADES_MAX) return Object.fromEntries(entries);
  return Object.fromEntries(entries.sort((a, b) => b[1].requestAt - a[1].requestAt).slice(0, TASK_GRADES_MAX));
}

/** A kept answer young enough to show without asking. */
export function freshGrade(entry: TaskGradeEntry | undefined, now: UnixSeconds): { grade: AssignGrade; fetchedAt: UnixSeconds } | null {
  if (!entry?.grade || entry.fetchedAt === null || now - entry.fetchedAt >= TASK_GRADE_CACHE_SEC) return null;
  return { grade: entry.grade, fetchedAt: entry.fetchedAt };
}

async function save(store: KeyValueStore, userId: UserId, key: string, entry: TaskGradeEntry): Promise<void> {
  const grades = (await readUser(store, userId, 'taskGrades')) ?? {};
  // A task dropped at the end of its semester takes its grade with it.
  const kept = new Set((await readUser(store, userId, 'tasks')).flatMap((t) => (t.cmId === null ? [] : [t.cmId])));
  await writeUserIfCurrent(store, userId, 'taskGrades', pruneGrades({ ...grades, [key]: entry }, kept));
}

/**
 * The grade of one of the current account's assignments: the kept answer while it is fresh (unless
 * `again`), else one GET. Never throws: a failure is an outcome the screen shows with "Buka di SIKOLA".
 */
export async function taskGradeForCurrent(deps: TaskGradeDeps, cmid: number, again: boolean): Promise<TaskGradeOutcome> {
  if (!Number.isSafeInteger(cmid) || cmid <= 0) return { status: 'failed', reason: 'NOT_A_TASK' };
  const userId = await currentUser(deps.store);
  if (userId === null) return { status: 'failed', reason: 'NO_ACCOUNT' };
  const tasks = await readUser(deps.store, userId, 'tasks');
  const taskState = await readUser(deps.store, userId, 'taskState');
  const now = deps.clock.now();
  if (!tasks.some((t) => t.cmId === cmid && showsGradeCard(t, getTaskState(taskState, t.eventId).doneManually, now))) return { status: 'failed', reason: 'NOT_A_TASK' };
  const key = String(cmid);
  const entry = ((await readUser(deps.store, userId, 'taskGrades')) ?? {})[key];
  const fresh = freshGrade(entry, now);
  if (fresh && !again) return { status: 'ok', ...fresh, cached: true };
  if (entry && now - entry.requestAt < TASK_GRADE_COOLDOWN_SEC) return { status: 'cooldown', retryAt: entry.requestAt + TASK_GRADE_COOLDOWN_SEC };
  if ((await readSession(deps.store)).state === 'EXPIRED') return { status: 'failed', reason: 'SESSION_EXPIRED' };
  try {
    // The wait starts before the request, so a page that never answers still counts.
    await save(deps.store, userId, key, { fetchedAt: entry?.fetchedAt ?? null, grade: entry?.grade ?? null, requestAt: now });
    const page = await deps.client.fetchPage(assignViewPath(cmid), { source: 'assign' });
    if (page.kind !== 'ok') return { status: 'failed', reason: page.kind === 'refused' ? page.reason : page.kind };
    // Only the page's numeric account id is read (presensi/page-user.ts).
    const pageUser = pageUserId(page.html);
    if (pageUser === null) return { status: 'user_unverified' };
    if (pageUser !== userId) {
      await deps.store.set(ACCOUNT_PENDING_KEY, newPending(pageUser, now));
      return { status: 'account_mismatch' };
    }
    const grade = parseAssignGrade(page.html);
    await save(deps.store, userId, key, { fetchedAt: now, requestAt: now, grade });
    return { status: 'ok', grade, fetchedAt: now, cached: false };
  } catch (e) {
    return { status: 'failed', reason: e instanceof Error ? e.name : 'ERROR' };
  }
}
