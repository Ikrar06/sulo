// Which active courses get their structure checked in this sync. Pure.
// Automatic syncs take turns: at most RADAR_AUTO_MAX courses per cycle, each
// at most every MIN_GAP_H hours, courses with a deadline in the next 7 days
// first, then the longest-unchecked (never checked comes first). "Perbarui"
// checks every active course. Still one request per cycle: the checks ride
// in the existing batch.

import { RADAR_AUTO_MAX } from '../moodle/limits';
import type { CourseId, Task, UnixSeconds } from '../types';

export const STATE_MIN_GAP_H = 6;
export const STATE_MAX_PER_BATCH = RADAR_AUTO_MAX;
/** Days ahead that make a deadline "soon" for the turn order. */
export const SOON_DAYS = 7;
/** A course that failed with an access error is skipped this long. */
export const ACCESS_SKIP_H = 24;
/** After ACCESS_FLAG_AFTER failures in a row: tried once a week (owner's rule, 20 Nov 2026). */
export const ACCESS_SKIP_WEEK_H = 7 * 24;
/** After this many access failures in a row the course is flagged (M5a shows it). */
export const ACCESS_FLAG_AFTER = 3;

export function pickCoursesToCheck(
  activeIds: readonly CourseId[],
  checkedAt: Readonly<Record<string, UnixSeconds>>,
  now: UnixSeconds,
  opts: {
    minGapH?: number;
    maxPerBatch?: number;
    accessFailedAt?: Readonly<Record<string, UnixSeconds>>;
    /** Access failures in a row per course: from ACCESS_FLAG_AFTER on, a week between tries. */
    accessFailures?: Readonly<Record<string, number>>;
    /** Courses with a deadline soon: they go first. */
    soon?: ReadonlySet<CourseId>;
    /** "Perbarui": every course, whatever its last check. */
    all?: boolean;
  } = {},
): CourseId[] {
  const gap = (opts.minGapH ?? STATE_MIN_GAP_H) * 3600;
  const max = opts.maxPerBatch ?? STATE_MAX_PER_BATCH;
  const soon = (id: CourseId) => (opts.soon?.has(id) ? 0 : 1);
  return [...activeIds]
    .filter((id) => {
      const failed = opts.accessFailedAt?.[String(id)];
      const skipH = (opts.accessFailures?.[String(id)] ?? 0) >= ACCESS_FLAG_AFTER ? ACCESS_SKIP_WEEK_H : ACCESS_SKIP_H;
      if (failed !== undefined && now - failed < skipH * 3600) return false;
      if (opts.all) return true;
      const at = checkedAt[String(id)];
      return at === undefined || now - at >= gap;
    })
    .sort((a, b) => soon(a) - soon(b) || (checkedAt[String(a)] ?? -1) - (checkedAt[String(b)] ?? -1) || a - b)
    .slice(0, max);
}

/** Courses with a pending deadline in the next SOON_DAYS days. */
export function coursesDueSoon(tasks: readonly Pick<Task, 'courseId' | 'dueAt' | 'missingSince'>[], now: UnixSeconds): Set<CourseId> {
  const until = now + SOON_DAYS * 86_400;
  return new Set(tasks.filter((t) => t.missingSince === null && t.dueAt !== null && t.dueAt >= now && t.dueAt <= until).map((t) => t.courseId));
}
