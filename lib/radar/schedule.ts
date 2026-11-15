// Which active courses get their structure checked in this sync. Pure.
// At most MAX_PER_BATCH per cycle, each course at most every MIN_GAP_H hours,
// the longest-unchecked first (never checked comes first). Still one request
// per cycle: the checks ride in the existing batch.

import type { CourseId, UnixSeconds } from '../types';

export const STATE_MIN_GAP_H = 6;
export const STATE_MAX_PER_BATCH = 5;

export function pickCoursesToCheck(
  activeIds: readonly CourseId[],
  checkedAt: Readonly<Record<string, UnixSeconds>>,
  now: UnixSeconds,
  opts: { minGapH?: number; maxPerBatch?: number } = {},
): CourseId[] {
  const gap = (opts.minGapH ?? STATE_MIN_GAP_H) * 3600;
  const max = opts.maxPerBatch ?? STATE_MAX_PER_BATCH;
  return [...activeIds]
    .filter((id) => {
      const at = checkedAt[String(id)];
      return at === undefined || now - at >= gap;
    })
    .sort((a, b) => (checkedAt[String(a)] ?? -1) - (checkedAt[String(b)] ?? -1) || a - b)
    .slice(0, max);
}
