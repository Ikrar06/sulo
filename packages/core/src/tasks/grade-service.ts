// "Lihat nilai" (1.1.0): grades read only when the student taps for them, through the same client as everything
// else (allowlist, budget, queue, backoff), one page per tap, never in the background.
// - A course: its grade report (tasks/course-grades.ts), one page for all its assignments (owner's decision,
//   27 Nov 2026: no opening tasks one by one). The task's own "Lihat nilai" goes this way too.
// - A task whose course report Sulo could not read: the assignment's own page (tasks/grade.ts), on the next tap.
// Answers are kept per account while their task is (the "Sudah dinilai" filter, at most TASK_GRADES_MAX); a look
// within 24 hours of the last read (HTML_ON_DEMAND_TTL_H) asks nothing, and asking again waits 2 minutes. A task
// found graded for the first time is marked done (it is finished; the student can undo it in its details).
// Only the student's own SIKOLA assignments past due, gone from SIKOLA's list or marked done (grade-view.ts). A
// page that answers for another account is never stored (the attendance check). Grades stay on this device:
// never in a notification, a copied list, a calendar file or a bug report.

import { ACCOUNT_PENDING_KEY, newPending } from '../account/pending';
import type { MoodleClient } from '../moodle/client';
import { HTML_ON_DEMAND_TTL_H } from '../moodle/limits';
import { readSession } from '../moodle/session';
import { pageUserId } from '../presensi/page-user';
import { currentUser, readUser, writeUserIfCurrent } from '../storage';
import type { Clock, KeyValueStore, Task, UnixSeconds, UserId } from '../types';
import { courseReportPath, parseCourseReport } from './course-grades';
import { assignViewPath, parseAssignGrade, type AssignGrade } from './grade';
import { showsGradeCard } from './grade-view';
import { getTaskState, setDone } from './local-state';

export const TASK_GRADE_CACHE_SEC = HTML_ON_DEMAND_TTL_H * 3600;
export const TASK_GRADE_COOLDOWN_SEC = 120;
/** Answers kept per account, newest first (a semester's assignments). */
export const TASK_GRADES_MAX = 200;

export interface TaskGradeEntry {
  /** When a page last gave this grade; null while every request so far failed. */
  fetchedAt: UnixSeconds | null;
  /** The last request, for the 2-minute wait. */
  requestAt: UnixSeconds;
  grade: AssignGrade | null;
}

/** Keyed by the assignment's cmid. */
export type TaskGrades = Record<string, TaskGradeEntry>;

/** One course's report reads, keyed by course id. */
export interface GradeRead {
  fetchedAt: UnixSeconds | null;
  requestAt: UnixSeconds;
  /** The report page was not recognized: this course's tasks read their own pages instead. */
  unreadable?: true;
}
export type GradeReads = Record<string, GradeRead>;

type PageProblem =
  | { status: 'cooldown'; retryAt: UnixSeconds }
  /** NO_ACCOUNT, SESSION_EXPIRED, NOT_A_TASK, NOT_A_COURSE, REPORT_UNREADABLE, a client refusal or a transport failure. */
  | { status: 'failed'; reason: string }
  | { status: 'account_mismatch' }
  | { status: 'user_unverified' };

export type TaskGradeOutcome = { status: 'ok'; grade: AssignGrade; fetchedAt: UnixSeconds; cached: boolean; markedDone: boolean } | PageProblem;

/** `graded`: the course's assignments with a grade; `markedDone`: the cmids just found graded and marked done. */
export type CourseGradeOutcome = { status: 'ok'; fetchedAt: UnixSeconds; cached: boolean; graded: number; markedDone: number[] } | PageProblem;

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

/** The current account's assignments "Lihat nilai" may read (grade-view.ts showsGradeCard). */
async function gradableTasks(store: KeyValueStore, userId: UserId, now: UnixSeconds): Promise<Task[]> {
  const [tasks, state] = await Promise.all([readUser(store, userId, 'tasks'), readUser(store, userId, 'taskState')]);
  return tasks.filter((t) => showsGradeCard(t, getTaskState(state, t.eventId).doneManually, now));
}

/** New answers in, the ones for tasks no longer kept out; the tasks found graded for the first time marked done. */
async function saveAnswers(store: KeyValueStore, userId: UserId, answers: Map<number, TaskGradeEntry>): Promise<Set<number>> {
  const [grades, tasks, state] = await Promise.all([readUser(store, userId, 'taskGrades'), readUser(store, userId, 'tasks'), readUser(store, userId, 'taskState')]);
  const firstGraded = new Set([...answers].filter(([cmid, e]) => e.grade?.kind === 'graded' && grades?.[String(cmid)]?.grade?.kind !== 'graded').map(([cmid]) => cmid));
  const next = { ...(grades ?? {}), ...Object.fromEntries([...answers].map(([cmid, e]) => [String(cmid), e])) };
  const kept = new Set(tasks.flatMap((t) => (t.cmId === null ? [] : [t.cmId])));
  await writeUserIfCurrent(store, userId, 'taskGrades', pruneGrades(next, kept));
  const finish = tasks.filter((t) => t.cmId !== null && firstGraded.has(t.cmId) && !getTaskState(state, t.eventId).doneManually);
  if (finish.length > 0) await writeUserIfCurrent(store, userId, 'taskState', finish.reduce((m, t) => setDone(m, t.eventId, true), state));
  return new Set(finish.flatMap((t) => (t.cmId === null ? [] : [t.cmId])));
}

/** One page of the current account: its html, or why not (the account check of attendance pages). */
async function ownPage(deps: TaskGradeDeps, userId: UserId, path: string, now: UnixSeconds): Promise<{ html: string } | PageProblem> {
  const page = await deps.client.fetchPage(path, { source: 'assign' });
  if (page.kind !== 'ok') return { status: 'failed', reason: page.kind === 'refused' ? page.reason : page.kind };
  // Only the page's numeric account id is read (presensi/page-user.ts).
  const pageUser = pageUserId(page.html);
  if (pageUser === null) return { status: 'user_unverified' };
  if (pageUser !== userId) {
    await deps.store.set(ACCOUNT_PENDING_KEY, newPending(pageUser, now));
    return { status: 'account_mismatch' };
  }
  return { html: page.html };
}

const failure = (e: unknown): PageProblem => ({ status: 'failed', reason: e instanceof Error ? e.name : 'ERROR' });

/**
 * One course's grades for all its assignments the student may look at: the kept read while it is fresh (unless
 * `again`), else one GET of the course's grade report. Never throws.
 */
export async function courseGradesForCurrent(deps: TaskGradeDeps, courseId: number, again: boolean): Promise<CourseGradeOutcome> {
  const userId = await currentUser(deps.store);
  if (userId === null) return { status: 'failed', reason: 'NO_ACCOUNT' };
  const now = deps.clock.now();
  const ours = (await gradableTasks(deps.store, userId, now)).filter((t) => t.courseId === courseId && t.cmId !== null);
  // Only a course of the student's own with an assignment to look at.
  if (!Number.isSafeInteger(courseId) || courseId <= 0 || ours.length === 0) return { status: 'failed', reason: 'NOT_A_COURSE' };
  const reads = (await readUser(deps.store, userId, 'gradeReads')) ?? {};
  const read = reads[String(courseId)];
  const grades = (await readUser(deps.store, userId, 'taskGrades')) ?? {};
  const gradedNow = () => ours.filter((t) => grades[String(t.cmId)]?.grade?.kind === 'graded').length;
  if (read?.unreadable) return { status: 'failed', reason: 'REPORT_UNREADABLE' };
  if (!again && read?.fetchedAt != null && now - read.fetchedAt < TASK_GRADE_CACHE_SEC) return { status: 'ok', fetchedAt: read.fetchedAt, cached: true, graded: gradedNow(), markedDone: [] };
  if (read && now - read.requestAt < TASK_GRADE_COOLDOWN_SEC) return { status: 'cooldown', retryAt: read.requestAt + TASK_GRADE_COOLDOWN_SEC };
  if ((await readSession(deps.store)).state === 'EXPIRED') return { status: 'failed', reason: 'SESSION_EXPIRED' };
  const saveRead = (r: GradeRead) => writeUserIfCurrent(deps.store, userId, 'gradeReads', { ...reads, [String(courseId)]: r });
  try {
    // The wait starts before the request, so a page that never answers still counts.
    await saveRead({ fetchedAt: read?.fetchedAt ?? null, requestAt: now });
    const page = await ownPage(deps, userId, courseReportPath(courseId), now);
    if (!('html' in page)) return page;
    const report = parseCourseReport(page.html);
    if (report.kind !== 'ok') {
      // Not a report Sulo knows (or one the course hides): its tasks read their own pages from now on.
      await saveRead({ fetchedAt: null, requestAt: now, unreadable: true });
      return { status: 'failed', reason: 'REPORT_UNREADABLE' };
    }
    // Every assignment of ours the report lists; one it leaves out keeps what was known.
    const answers = new Map(ours.flatMap((t) => (report.grades.has(t.cmId!) ? [[t.cmId!, { fetchedAt: now, requestAt: now, grade: report.grades.get(t.cmId!)! }] as const] : [])));
    const marked = await saveAnswers(deps.store, userId, answers);
    await saveRead({ fetchedAt: now, requestAt: now });
    const graded = ours.filter((t) => answers.get(t.cmId!)?.grade.kind === 'graded' || (!answers.has(t.cmId!) && grades[String(t.cmId)]?.grade?.kind === 'graded')).length;
    return { status: 'ok', fetchedAt: now, cached: false, graded, markedDone: [...marked] };
  } catch (e) {
    return failure(e);
  }
}

/**
 * One task's grade: the kept answer while it is fresh (unless `again`); else its course's report (all the
 * course's assignments at once), or, once that report proved unreadable, the assignment's own page. Never throws.
 */
export async function taskGradeForCurrent(deps: TaskGradeDeps, cmid: number, again: boolean): Promise<TaskGradeOutcome> {
  if (!Number.isSafeInteger(cmid) || cmid <= 0) return { status: 'failed', reason: 'NOT_A_TASK' };
  const userId = await currentUser(deps.store);
  if (userId === null) return { status: 'failed', reason: 'NO_ACCOUNT' };
  const now = deps.clock.now();
  const task = (await gradableTasks(deps.store, userId, now)).find((t) => t.cmId === cmid);
  if (!task) return { status: 'failed', reason: 'NOT_A_TASK' };
  const grades = (await readUser(deps.store, userId, 'taskGrades')) ?? {};
  const fresh = freshGrade(grades[String(cmid)], now);
  if (fresh && !again) return { status: 'ok', ...fresh, cached: true, markedDone: false };
  const reads = (await readUser(deps.store, userId, 'gradeReads')) ?? {};
  if (!reads[String(task.courseId)]?.unreadable) {
    const course = await courseGradesForCurrent(deps, task.courseId, again);
    if (course.status !== 'ok') return course;
    const entry = ((await readUser(deps.store, userId, 'taskGrades')) ?? {})[String(cmid)];
    // The report left this assignment out (its grade hidden from students): graded or not, nothing to show.
    return { status: 'ok', grade: entry?.grade ?? { kind: 'not_shown' }, fetchedAt: course.fetchedAt, cached: course.cached, markedDone: course.markedDone.includes(cmid) };
  }
  return assignmentPage(deps, userId, task, grades, now);
}

/** The assignment's own page (a course whose report Sulo could not read). */
async function assignmentPage(deps: TaskGradeDeps, userId: UserId, task: Task, grades: TaskGrades, now: UnixSeconds): Promise<TaskGradeOutcome> {
  const cmid = task.cmId!;
  const entry = grades[String(cmid)];
  if (entry && now - entry.requestAt < TASK_GRADE_COOLDOWN_SEC) return { status: 'cooldown', retryAt: entry.requestAt + TASK_GRADE_COOLDOWN_SEC };
  if ((await readSession(deps.store)).state === 'EXPIRED') return { status: 'failed', reason: 'SESSION_EXPIRED' };
  try {
    await saveAnswers(deps.store, userId, new Map([[cmid, { fetchedAt: entry?.fetchedAt ?? null, grade: entry?.grade ?? null, requestAt: now }]]));
    const page = await ownPage(deps, userId, assignViewPath(cmid), now);
    if (!('html' in page)) return page;
    const grade = parseAssignGrade(page.html);
    const marked = await saveAnswers(deps.store, userId, new Map([[cmid, { fetchedAt: now, requestAt: now, grade }]]));
    return { status: 'ok', grade, fetchedAt: now, cached: false, markedDone: marked.has(cmid) };
  } catch (e) {
    return failure(e);
  }
}

