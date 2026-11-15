import type { ActiveReason, CourseId, CourseRecord, UnixSeconds } from '../types';

export const ACTIVE_THRESHOLD = 4;

const WEIGHTS: Record<ActiveReason, number> = {
  inprogress: 4,
  enddate_future: 2,
  upcoming_events: 2,
  past: -3,
  ended_long_ago: -4,
};

const DAY = 86_400;

export interface ScoreInput {
  inProgress: boolean;
  past: boolean;
  enddate: UnixSeconds;
  hasUpcomingEvents: boolean;
}

/** Score and the reasons behind it (docs: ARCHITECTURE section 8). */
export function scoreCourse(input: ScoreInput, now: UnixSeconds): { score: number; reasons: ActiveReason[] } {
  const reasons: ActiveReason[] = [];
  if (input.inProgress) reasons.push('inprogress');
  if (input.enddate > now) reasons.push('enddate_future');
  if (input.hasUpcomingEvents) reasons.push('upcoming_events');
  if (input.past) reasons.push('past');
  if (input.enddate > 0 && input.enddate < now - 30 * DAY) reasons.push('ended_long_ago');
  return { score: reasons.reduce((sum, r) => sum + WEIGHTS[r], 0), reasons };
}

/** A manual pin always wins over the score. */
export function isCourseActive(course: Pick<CourseRecord, 'activePin' | 'activeScore'>): boolean {
  return course.activePin ?? course.activeScore >= ACTIVE_THRESHOLD;
}

export function activeCourseIds(courses: readonly CourseRecord[]): Set<CourseId> {
  return new Set(courses.filter(isCourseActive).map((c) => c.id));
}
