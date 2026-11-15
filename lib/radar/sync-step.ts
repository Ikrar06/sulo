// The radar's part of one sync cycle. It adds calls to the existing batch
// (still one request) and turns their results into change-log entries.
// Storage is injected; no browser APIs.

import { activeCourseIds } from '../courses/active-score';
import { calls, type MoodleCall } from '../moodle/calls';
import type { CallResult } from '../moodle/client';
import { parseCall } from '../moodle/schemas';
import { readUser, writeUser } from '../storage';
import type { Change, CourseRecord, KeyValueStore, Task, UnixSeconds, UserId } from '../types';
import { diffCourse } from './diff';
import { appendChanges } from './log';
import { scanNotifications } from './notifications';
import { pickCoursesToCheck } from './schedule';
import { itemsFromState } from './snapshot';
import { diffTasks } from './tasks-diff';

export interface RadarPlan {
  calls: MoodleCall[];
  /** Course ids, in the order of their get_state calls. */
  courseIds: number[];
  withNotifications: boolean;
}

/** Calls to add for a known user: notifications every cycle, structure of up to 5 courses. */
export async function planRadarCalls(store: KeyValueStore, userId: UserId | null, courses: readonly CourseRecord[], now: UnixSeconds): Promise<RadarPlan> {
  if (userId === null) return { calls: [], courseIds: [], withNotifications: false };
  const radar = await readUser(store, userId, 'radar');
  const active = [...activeCourseIds(courses)];
  const courseIds = pickCoursesToCheck(active, radar.stateCheckedAt, now);
  return {
    calls: [calls.popupNotifications(userId), ...courseIds.map((id) => calls.courseformatState(id))],
    courseIds,
    withNotifications: true,
  };
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

/** Applies the radar results; returns functions whose results failed validation. */
export async function applyRadarResults(store: KeyValueStore, r: RadarResults): Promise<string[]> {
  const broken: string[] = [];
  const radar = await readUser(store, r.userId, 'radar');
  const snapshots = { ...(await readUser(store, r.userId, 'snapshots')) };
  const changes: Change[] = [];
  let { notificationsLastId, calendarBaseline } = radar;
  const stateCheckedAt = { ...radar.stateCheckedAt };

  if (r.nextTasks) {
    changes.push(...diffTasks(r.previousTasks, r.nextTasks, !calendarBaseline));
    calendarBaseline = true;
  }

  let index = 0;
  if (r.plan.withNotifications) {
    const result = r.results[index++];
    const parsed = result ? parseCall('message_popup_get_popup_notifications', result) : null;
    if (parsed?.ok) {
      const scan = scanNotifications(parsed.data.notifications, notificationsLastId, r.origin);
      changes.push(...scan.changes);
      notificationsLastId = scan.lastId;
    } else if (parsed && parsed.status === 'PARSER_BROKEN') {
      broken.push('message_popup_get_popup_notifications');
    }
  }

  for (const courseId of r.plan.courseIds) {
    const result = r.results[index++];
    stateCheckedAt[String(courseId)] = r.now;
    const parsed = result ? parseCall('core_courseformat_get_state', result) : null;
    // Only a result that passed validation is diffed. A failed one is never
    // read as "everything was removed"; a Moodle error for one course (no
    // access, course gone) is skipped quietly.
    if (!parsed?.ok) {
      if (parsed && parsed.status === 'PARSER_BROKEN') broken.push('core_courseformat_get_state');
      continue;
    }
    const diff = diffCourse(snapshots[String(courseId)] ?? null, itemsFromState(parsed.data), { userId: r.userId, courseId, now: r.now });
    snapshots[String(courseId)] = diff.next;
    changes.push(...diff.changes);
  }

  if (changes.length > 0) {
    const log = await readUser(store, r.userId, 'changes');
    await writeUser(store, r.userId, 'changes', appendChanges(log, changes, r.now));
  }
  await writeUser(store, r.userId, 'snapshots', snapshots);
  await writeUser(store, r.userId, 'radar', { stateCheckedAt, notificationsLastId, calendarBaseline });
  return [...new Set(broken)];
}
