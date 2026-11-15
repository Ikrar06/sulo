// The radar's part of one sync cycle. It adds calls to the existing batch
// (still one request) and turns their results into change-log entries.
// Storage is injected; no browser APIs.

import { activeCourseIds } from '../courses/active-score';
import { calls, type MoodleCall } from '../moodle/calls';
import { NOTIFICATIONS_LIMIT, NOTIFICATIONS_LIMIT_SMALL, TASKS_TTL_MIN, TTL_TOLERANCE_MIN } from '../moodle/limits';
import type { CallResult } from '../moodle/client';
import { parseCall } from '../moodle/schemas';
import { readUser, writeUser, type CourseAccess } from '../storage';
import type { Change, CourseRecord, KeyValueStore, Task, UnixSeconds, UserId } from '../types';
import { diffCourse } from './diff';
import { appendChanges } from './log';
import { scanNotifications } from './notifications';
import { courseErrorKind } from './course-errors';
import { ACCESS_FLAG_AFTER, pickCoursesToCheck } from './schedule';
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

/** Calls to add for a known user: notifications when due, structure of up to 5 courses. */
export async function planRadarCalls(store: KeyValueStore, userId: UserId | null, courses: readonly CourseRecord[], now: UnixSeconds): Promise<RadarPlan> {
  if (userId === null) return EMPTY_RADAR_PLAN;
  const radar = await readUser(store, userId, 'radar');
  const active = [...activeCourseIds(courses)];
  const accessFailedAt = Object.fromEntries(Object.entries(radar.courseAccess ?? {}).map(([id, a]) => [id, a.lastFailedAt]));
  const courseIds = pickCoursesToCheck(active, radar.stateCheckedAt, now, { accessFailedAt });
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

  let index = 0;
  if (r.plan.withNotifications) {
    const result = r.results[index++];
    const parsed = result ? parseCall('message_popup_get_popup_notifications', result) : null;
    if (parsed?.ok) {
      const ids = parsed.data.notifications.map((n) => n.id);
      notificationsWide = nextNotificationsWide(r.plan.notificationsLimit, ids, notificationsLastId);
      const scan = scanNotifications(parsed.data.notifications, notificationsLastId, r.origin);
      changes.push(...scan.changes);
      notificationsLastId = scan.lastId;
      notificationsFetchedAt = r.now;
    } else if (parsed && parsed.status === 'PARSER_BROKEN') {
      broken.push('message_popup_get_popup_notifications');
    }
  }

  for (const courseId of r.plan.courseIds) {
    const key = String(courseId);
    const result = r.results[index++];
    stateCheckedAt[key] = r.now;
    const parsed = result ? parseCall('core_courseformat_get_state', result) : null;
    // Only a result that passed validation is diffed. A failed one is never
    // read as "everything was removed".
    if (!parsed) continue;
    if (!parsed.ok) {
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
    const diff = diffCourse(snapshots[key] ?? null, itemsFromState(parsed.data), { userId: r.userId, courseId, now: r.now });
    snapshots[key] = diff.next;
    changes.push(...diff.changes);
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
  });
  const sikolaTrouble = r.plan.courseIds.length > 0 && otherFailures === r.plan.courseIds.length;
  return { broken: [...new Set(broken)], sikolaTrouble };
}
