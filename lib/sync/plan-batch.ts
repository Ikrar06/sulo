// What goes into one sync batch, given what is due and what quota is left.
// Pure. Session and calendar are always in; everything else is optional.
//
// Due (TTL): course list every 24 hours for every trigger, including setup
// (force only for "Segarkan daftar"); notifications every 3 hours; each
// course structure every 6 hours, at most 5 per batch (lib/radar/schedule.ts).
//
// Low quota: optional parts are dropped in a fixed order, structure first,
// then the course list re-fetch, then notifications. Session and calendar stay
// until the budget itself refuses the request.

import { calls, type MoodleCall } from '../moodle/calls';
import { QUOTA_LOW, QUOTA_LOWER, QUOTA_LOWEST } from '../moodle/limits';
import { radarPlanWith, type RadarPlan } from '../radar/sync-step';
import type { UnixSeconds, UserId } from '../types';

export type DroppedPart = 'structure' | 'course_list' | 'notifications';

export interface BatchPlanInput {
  now: UnixSeconds;
  /** The course list is due (24 hours) or forced by "Segarkan daftar". */
  courseListDue: boolean;
  /** No course list was ever stored: it is needed, never dropped. */
  courseListMissing: boolean;
  radar: RadarPlan;
  /** Null when no user is known yet (no radar calls then). */
  userId: UserId | null;
  remaining: { posts: number; calls: number };
}

export interface BatchPlan {
  calls: MoodleCall[];
  withCourseList: boolean;
  radar: RadarPlan;
  /** Index of the first radar call in `calls`. */
  radarStart: number;
  dropped: DroppedPart[];
}

const below = (r: { posts: number; calls: number }, t: { posts: number; calls: number }) => r.posts < t.posts || r.calls < t.calls;

/** Which optional parts the remaining quota still allows. */
export function partsToDrop(remaining: { posts: number; calls: number }): DroppedPart[] {
  const dropped: DroppedPart[] = [];
  if (below(remaining, QUOTA_LOW)) dropped.push('structure');
  if (below(remaining, QUOTA_LOWER)) dropped.push('course_list');
  if (below(remaining, QUOTA_LOWEST)) dropped.push('notifications');
  return dropped;
}

export function planBatch(input: BatchPlanInput): BatchPlan {
  const drop = new Set(partsToDrop(input.remaining));
  const dropped: DroppedPart[] = [];

  let withCourseList = input.courseListDue || input.courseListMissing;
  if (withCourseList && !input.courseListMissing && drop.has('course_list')) {
    withCourseList = false;
    dropped.push('course_list');
  }

  let radar = input.radar;
  if (input.userId !== null) {
    const courseIds = drop.has('structure') ? [] : radar.courseIds;
    const withNotifications = drop.has('notifications') ? false : radar.withNotifications;
    if (courseIds.length < radar.courseIds.length) dropped.push('structure');
    if (withNotifications !== radar.withNotifications) dropped.push('notifications');
    radar = radarPlanWith(input.userId, { courseIds, withNotifications, notificationsLimit: radar.notificationsLimit });
  }

  const head: MoodleCall[] = [calls.sessionTimeRemaining(), calls.calendarActionEvents(input.now)];
  if (withCourseList) head.push(calls.enrolledCourses('all'), calls.enrolledCourses('inprogress'));
  return { calls: [...head, ...radar.calls], withCourseList, radar, radarStart: head.length, dropped };
}
