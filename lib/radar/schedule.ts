// Which active courses get their structure checked in this sync. Pure.
// At most MAX_PER_BATCH per cycle, each course at most every MIN_GAP_H hours,
// the longest-unchecked first (never checked comes first). Still one request
// per cycle: the checks ride in the existing batch.

import type { CourseId, UnixSeconds } from '../types';

export const STATE_MIN_GAP_H = 6;
export const STATE_MAX_PER_BATCH = 5;
/** A course that failed with an access error is skipped this long. */
export const ACCESS_SKIP_H = 24;
/** After this many access failures in a row the course is flagged (M5a shows it). */
export const ACCESS_FLAG_AFTER = 3;

export function pickCoursesToCheck(
  activeIds: readonly CourseId[],
  checkedAt: Readonly<Record<string, UnixSeconds>>,
  now: UnixSeconds,
  opts: { minGapH?: number; maxPerBatch?: number; accessFailedAt?: Readonly<Record<string, UnixSeconds>> } = {},
): CourseId[] {
  const gap = (opts.minGapH ?? STATE_MIN_GAP_H) * 3600;
  const max = opts.maxPerBatch ?? STATE_MAX_PER_BATCH;
  return [...activeIds]
    .filter((id) => {
      const failed = opts.accessFailedAt?.[String(id)];
      if (failed !== undefined && now - failed < ACCESS_SKIP_H * 3600) return false;
      const at = checkedAt[String(id)];
      return at === undefined || now - at >= gap;
    })
    .sort((a, b) => (checkedAt[String(a)] ?? -1) - (checkedAt[String(b)] ?? -1) || a - b)
    .slice(0, max);
}
