// The radar's part of one sync cycle. It adds calls to the existing batch
// (still one request) and turns their results into change-log entries.
// Storage is injected; no browser APIs.

import { activeCourseIds } from '../courses/active-score';
import { calls, type MoodleCall } from '../moodle/calls';
import { MAX_STATE_CALLS_PER_BATCH, NOTIFICATIONS_LIMIT, NOTIFICATIONS_LIMIT_SMALL, TASKS_TTL_MIN, TTL_TOLERANCE_MIN } from '../moodle/limits';
import type { CallResult } from '../moodle/client';
import { parseCall } from '../moodle/schemas';
import { readUser, writeUser, type CourseAccess, type RadarRun } from '../storage';
import type { Change, CourseRecord, KeyValueStore, Task, UnixSeconds, UserId } from '../types';
import { diffCourse } from './diff';
import { appendChanges } from './log';
import { scanNotifications } from './notifications';
import { courseErrorKind } from './course-errors';
import { ACCESS_FLAG_AFTER, coursesDueSoon, pickCoursesToCheck } from './schedule';
import { itemsFromState } from './snapshot';
import { diffTasks } from './tasks-diff';

export interface RadarPlan {
  calls: MoodleCall[];
  /** Course ids, in the order of their get_state calls. */
  courseIds: number[];
  withNotifications: boolean;
  /** Page size of the notification call (20 for the baseline or a catch-up, else 10). */
  notificationsLimit: number;
}

export const EMPTY_RADAR_PLAN: RadarPlan = { calls: [], courseIds: [], withNotifications: false, notificationsLimit: 0 };

/** Rebuilds the call list after parts of a plan were dropped (plan-batch.ts). */
export function radarPlanWith(userId: UserId, plan: Pick<RadarPlan, 'courseIds' | 'withNotifications' | 'notificationsLimit'>): RadarPlan {
  return {
    ...plan,
    calls: [
      ...(plan.withNotifications ? [calls.popupNotifications(userId, plan.notificationsLimit)] : []),
      ...plan.courseIds.map((id) => calls.courseformatState(id)),
    ],
  };
}

/** Notifications are due every 3 hours (with slack for alarm timing). */
export function notificationsDue(radar: { notificationsFetchedAt?: UnixSeconds }, now: UnixSeconds): boolean {
  const at = radar.notificationsFetchedAt;
  return at === undefined || now - at >= (TASKS_TTL_MIN - TTL_TOLERANCE_MIN) * 60;
}

/**
 * How much of the radar a sync carries: `full` ("Perbarui") checks every
 * active course; `normal` (automatic) checks up to 4 in turns; `saver`
 * (automatic, past the soft daily limit) checks no course structure.
 */
export type RadarMode = 'full' | 'normal' | 'saver';

/** Calls to add for a known user: notifications when due, course structures by mode. */
export async function planRadarCalls(
  store: KeyValueStore,
  userId: UserId | null,
  courses: readonly CourseRecord[],
  now: UnixSeconds,
  mode: RadarMode = 'normal',
  tasks: readonly Task[] = [],
): Promise<RadarPlan> {
  if (userId === null) return EMPTY_RADAR_PLAN;
  const radar = await readUser(store, userId, 'radar');
  const active = [...activeCourseIds(courses)];
  const accessFailedAt = Object.fromEntries(Object.entries(radar.courseAccess ?? {}).map(([id, a]) => [id, a.lastFailedAt]));
  const courseIds =
    mode === 'saver'
      ? []
      : pickCoursesToCheck(active, radar.stateCheckedAt, now, {
          accessFailedAt,
          soon: coursesDueSoon(tasks, now),
          ...(mode === 'full' ? { all: true, maxPerBatch: MAX_STATE_CALLS_PER_BATCH } : {}),
        });
  const withNotifications = notificationsDue(radar, now);
  const notificationsLimit = radar.notificationsLastId === null || radar.notificationsWide ? NOTIFICATIONS_LIMIT : NOTIFICATIONS_LIMIT_SMALL;
  return radarPlanWith(userId, { courseIds, withNotifications, notificationsLimit });
}

/** A small page that is entirely new may hide more: widen the next fetch. */
export function nextNotificationsWide(limit: number, ids: readonly number[], lastId: number | null): boolean {
  if (lastId === null || limit >= NOTIFICATIONS_LIMIT) return false;
  return ids.length >= limit && ids.every((id) => id > lastId);
}

export interface RadarResults {
  userId: UserId;
  now: UnixSeconds;
  origin: string;
  plan: RadarPlan;
  /** Results for plan.calls, in the same order. */
  results: readonly (CallResult | undefined)[];
  previousTasks: readonly Task[];
  /** Tasks after this cycle's calendar merge; null when the calendar failed. */
  nextTasks: readonly Task[] | null;
}

export interface RadarOutcome {
  /** Functions whose results failed validation. */
  broken: string[];
  /** Every get_state failed with a non-access error while the session call worked: SIKOLA trouble. */
  sikolaTrouble: boolean;
}

/**
 * A course structure fetched outside a sync (the Presensi page looking for
 * its attendance activity): stored like the radar's, so the next radar pass
 * diffs against it. A first structure is a baseline (no entries).
 */
export async function storeCourseState(store: KeyValueStore, userId: UserId, courseId: number, items: ReturnType<typeof itemsFromState>, now: UnixSeconds): Promise<void> {
  const snapshots = { ...(await readUser(store, userId, 'snapshots')) };
  const key = String(courseId);
  const diff = diffCourse(snapshots[key] ?? null, items, { userId, courseId, now });
  snapshots[key] = diff.next;
  await writeUser(store, userId, 'snapshots', snapshots);
  if (diff.changes.length > 0) await writeUser(store, userId, 'changes', appendChanges(await readUser(store, userId, 'changes'), diff.changes, now));
  const radar = await readUser(store, userId, 'radar');
  await writeUser(store, userId, 'radar', { ...radar, stateCheckedAt: { ...radar.stateCheckedAt, [key]: now } });
}

/** Applies the radar results. */
export async function applyRadarResults(store: KeyValueStore, r: RadarResults): Promise<RadarOutcome> {
  const broken: string[] = [];
  const radar = await readUser(store, r.userId, 'radar');
  const snapshots = { ...(await readUser(store, r.userId, 'snapshots')) };
  const courseAccess: Record<string, CourseAccess> = { ...(radar.courseAccess ?? {}) };
  const changes: Change[] = [];
  let { notificationsLastId, calendarBaseline, notificationsFetchedAt, notificationsWide } = radar;
  const stateCheckedAt = { ...radar.stateCheckedAt };
  let accessFailures = 0;
  let otherFailures = 0;

  if (r.nextTasks) {
    changes.push(...diffTasks(r.previousTasks, r.nextTasks, !calendarBaseline));
    calendarBaseline = true;
  }

  const run: RadarRun = { at: r.now, planned: r.plan.courseIds.length, stored: 0, errors: {}, notifications: 'skipped' };
  const countError = (code: string) => void (run.errors[code] = (run.errors[code] ?? 0) + 1);

  let index = 0;
  if (r.plan.withNotifications) {
    const result = r.results[index++];
    // A failure here never stops the course structures below.
    try {
      const parsed = result ? parseCall('message_popup_get_popup_notifications', result) : null;
      if (parsed?.ok) {
        const ids = parsed.data.notifications.map((n) => n.id);
        notificationsWide = nextNotificationsWide(r.plan.notificationsLimit, ids, notificationsLastId);
        const scan = scanNotifications(parsed.data.notifications, notificationsLastId, r.origin);
        changes.push(...scan.changes);
        notificationsLastId = scan.lastId;
        notificationsFetchedAt = r.now;
        run.notifications = 'ok';
      } else if (parsed && parsed.status === 'PARSER_BROKEN') {
        broken.push('message_popup_get_popup_notifications');
        run.notifications = 'broken';
      } else {
        run.notifications = 'error';
      }
    } catch (e) {
      run.notifications = 'error';
      run.failure = `notifications: ${e instanceof Error ? e.name : 'Error'}`;
    }
  }

  for (const courseId of r.plan.courseIds) {
    const key = String(courseId);
    const result = r.results[index++];
    stateCheckedAt[key] = r.now;
    const parsed = result ? parseCall('core_courseformat_get_state', result) : null;
    // Only a result that passed validation is diffed. A failed one is never
    // read as "everything was removed".
    if (!parsed) {
      countError('missing');
      continue;
    }
    if (!parsed.ok) {
      countError(parsed.status === 'PARSER_BROKEN' ? 'parser_broken' : parsed.errorcode);
      if (parsed.status === 'PARSER_BROKEN') {
        broken.push('core_courseformat_get_state');
      } else if (courseErrorKind(parsed.errorcode) === 'access') {
        // Not reachable for this user: skip 24 hours; flag after 3 in a row.
        const failures = (courseAccess[key]?.failures ?? 0) + 1;
        courseAccess[key] = { failures, lastFailedAt: r.now, lastErrorcode: parsed.errorcode, flagged: failures >= ACCESS_FLAG_AFTER };
        accessFailures += 1;
      } else {
        // Server trouble or unknown: retried at the next normal check.
        otherFailures += 1;
      }
      continue;
    }
    delete courseAccess[key];
    try {
      const diff = diffCourse(snapshots[key] ?? null, itemsFromState(parsed.data), { userId: r.userId, courseId, now: r.now });
      snapshots[key] = diff.next;
      changes.push(...diff.changes);
      run.stored += 1;
    } catch (e) {
      countError(`exception:${e instanceof Error ? e.name : 'Error'}`);
    }
  }

  if (changes.length > 0) {
    const log = await readUser(store, r.userId, 'changes');
    await writeUser(store, r.userId, 'changes', appendChanges(log, changes, r.now));
  }
  if (accessFailures > 0 || otherFailures > 0) {
    const stats = await readUser(store, r.userId, 'stats');
    await writeUser(store, r.userId, 'stats', {
      ...stats,
      courseAccessFailures: (stats.courseAccessFailures ?? 0) + accessFailures,
      courseOtherFailures: (stats.courseOtherFailures ?? 0) + otherFailures,
    });
  }
  await writeUser(store, r.userId, 'snapshots', snapshots);
  await writeUser(store, r.userId, 'radar', {
    stateCheckedAt,
    notificationsLastId,
    calendarBaseline,
    courseAccess,
    ...(notificationsFetchedAt !== undefined ? { notificationsFetchedAt } : {}),
    ...(notificationsWide ? { notificationsWide } : {}),
    lastRun: run,
  });
  const sikolaTrouble = r.plan.courseIds.length > 0 && otherFailures === r.plan.courseIds.length;
  return { broken: [...new Set(broken)], sikolaTrouble };
}
