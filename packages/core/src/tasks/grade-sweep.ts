// Task grades without a tap (owner's exception of 27 Nov 2026 to hard rule 4 and "one page per action", like the
// attendance recap of 18 Nov): the grade reports of the followed courses, so the history fills in (graded tasks,
// ones Sulo never saw in the calendar) with no course opened by hand.
// - Opening Tugas checks every followed course not read in the last COURSE_SWEEP_FRESH_SEC; each sync (not the
//   light checks, not in saver mode) checks every followed course not read in the last COURSE_SYNC_FRESH_SEC, all
//   at once (owner: never one by one; the first sync reads them all).
// - At most one sweep every SWEEP_GAP_SEC whatever started it (owner: opening Tugas again and again sends nothing
//   more). Its pages stay outside the loop guard's count (moodle/budget.ts, source 'assign'), so reading every
//   course never pauses Sulo; the day keeps DAY_SPARE requests for syncs. A refusal, an ended session or no
//   connection stops it; the rest waits for the next one.
// Through the same client and service as "Lihat nilai" (tasks/grade-service.ts): allowlist, budget, queue,
// backoff, the account check, grades only (never comments). Never throws.

import { activeCourseIds } from '../courses/active-score';
import { readBudget, remainingQuota } from '../moodle/budget';
import { readSession } from '../moodle/session';
import { currentUser, readUser, writeUserIfCurrent } from '../storage';
import type { UnixSeconds } from '../types';
import { courseGradesForCurrent, TASK_GRADE_COOLDOWN_SEC, type GradeRead, type TaskGradeDeps } from './grade-service';

/** Between two sweeps (owner: 5 to 10 minutes). */
export const SWEEP_GAP_SEC = 600;
/** Opening Tugas reads a course's report again after this long (grades do not change by the minute). */
export const COURSE_SWEEP_FRESH_SEC = 3600;
/** A sync reads it again after this long (syncs run every hour or so; the day's budget is 150 requests). */
export const COURSE_SYNC_FRESH_SEC = 6 * 3600;
/** Requests the day always keeps for syncs. */
export const DAY_SPARE = 20;
export const SWEEP_OPEN = { fresh: COURSE_SWEEP_FRESH_SEC } as const;
export const SWEEP_SYNC = { fresh: COURSE_SYNC_FRESH_SEC } as const;

export interface SweepResult {
  /** Course reports read. */
  read: number;
  /** Tasks found graded for the first time (marked done). */
  markedDone: number;
}

const NONE: SweepResult = { read: 0, markedDone: 0 };

/** A course whose report is due: never read, or read `fresh` ago; not one Sulo could not read, nor one just tried. */
export function reportDue(read: GradeRead | undefined, now: UnixSeconds, fresh: number = COURSE_SWEEP_FRESH_SEC): boolean {
  if (!read) return true;
  if (read.unreadable) return false;
  if (read.fetchedAt === null) return now - read.requestAt >= TASK_GRADE_COOLDOWN_SEC;
  return now - read.fetchedAt >= fresh;
}

/** Every followed course whose report is due, all at once (SWEEP_OPEN when Tugas opens, SWEEP_SYNC in a sync). */
export async function gradeSweep(deps: TaskGradeDeps, options: { fresh: number }): Promise<SweepResult> {
  try {
    const userId = await currentUser(deps.store);
    if (userId === null || (await readSession(deps.store)).state === 'EXPIRED') return NONE;
    const now = deps.clock.now();
    const last = (await readUser(deps.store, userId, 'gradeSweep'))?.at ?? null;
    if (last !== null && now - last < SWEEP_GAP_SEC) return NONE;
    const room = remainingQuota(await readBudget(deps.store, deps.clock)).posts - DAY_SPARE;
    if (room <= 0) return NONE;
    const courses = await readUser(deps.store, userId, 'courses');
    const followed = activeCourseIds(courses);
    const reads = (await readUser(deps.store, userId, 'gradeReads')) ?? {};
    const due = courses
      .filter((c) => followed.has(c.id) && reportDue(reads[String(c.id)], now, options.fresh))
      .sort((a, b) => (reads[String(a.id)]?.fetchedAt ?? 0) - (reads[String(b.id)]?.fetchedAt ?? 0))
      .slice(0, room);
    if (due.length === 0) return NONE;
    await writeUserIfCurrent(deps.store, userId, 'gradeSweep', { at: now });
    let read = 0;
    let markedDone = 0;
    for (const course of due) {
      // Due by the sweep's own hour, so past the service's 24-hour copy: asked again.
      const outcome = await courseGradesForCurrent(deps, course.id, true);
      if (outcome.status === 'ok') {
        read += 1;
        markedDone += outcome.markedDone.length;
        continue;
      }
      // One course whose report Sulo cannot read does not stop the others; anything else waits for next time.
      if (outcome.status !== 'failed' || outcome.reason !== 'REPORT_UNREADABLE') break;
    }
    return { read, markedDone };
  } catch {
    return NONE;
  }
}
