// Course structure diff (docs/ARCHITECTURE.md section 7). Pure.
//  1. First snapshot of a course: baseline, no changes.
//  2. parserVersion went up: silent baseline too.
//  3. Only called for a course result that passed validation; a failed result
//     is never read as "everything was removed" (the sync skips the diff).
//  4. Missing activity: missCount + 1; "removed" only after 2 checks in a row.
//  5. visible/uservisible changes are "hidden" or "shown", not removed/added.
//  6. Renames are logged; whether anything notifies is decided later (log.ts).

import type { Change, CourseId, CourseSnapshot, DiffResult, SnapshotItem, UnixSeconds, UserId } from '../types';
import { PARSER_VERSION } from '../types';
import type { FreshItem } from './snapshot';

/** Absent this many checks in a row before it counts as removed. */
export const REMOVED_AFTER_MISSES = 2;

const isVisible = (i: Pick<SnapshotItem, 'visible' | 'uservisible'>) => i.visible && i.uservisible;

export function diffCourse(
  previous: CourseSnapshot | null,
  fresh: readonly FreshItem[],
  ctx: { userId: UserId; courseId: CourseId; now: UnixSeconds },
): DiffResult {
  const { userId, courseId, now } = ctx;
  const baseline = previous === null || previous.parserVersion !== PARSER_VERSION;
  const items: Record<string, SnapshotItem> = {};
  const changes: Change[] = [];

  for (const f of fresh) {
    const before = baseline ? undefined : previous?.items[String(f.cmId)];
    items[String(f.cmId)] = { ...f, firstSeenAt: before?.firstSeenAt ?? now, missCount: 0 };
    if (baseline) continue;
    if (!before) {
      changes.push({ kind: 'added', courseId, cmId: f.cmId, module: f.module, name: f.name, url: f.url });
      continue;
    }
    if (before.name !== f.name) changes.push({ kind: 'renamed', courseId, cmId: f.cmId, module: f.module, from: before.name, to: f.name, url: f.url });
    // Snapshots from before M4 have no uservisible: treat as visible.
    const was = isVisible({ visible: before.visible, uservisible: before.uservisible ?? true });
    const now_ = isVisible(f);
    if (was && !now_) changes.push({ kind: 'hidden', courseId, cmId: f.cmId, module: f.module, name: f.name });
    if (!was && now_) changes.push({ kind: 'shown', courseId, cmId: f.cmId, module: f.module, name: f.name, url: f.url });
  }

  if (!baseline && previous) {
    const freshIds = new Set(fresh.map((f) => String(f.cmId)));
    for (const [key, item] of Object.entries(previous.items)) {
      if (freshIds.has(key)) continue;
      const missCount = item.missCount + 1;
      if (missCount >= REMOVED_AFTER_MISSES) {
        changes.push({ kind: 'removed', courseId, cmId: item.cmId, module: item.module, name: item.name });
      } else {
        items[key] = { ...item, missCount };
      }
    }
  }

  return { next: { userId, courseId, fetchedAt: now, parserVersion: PARSER_VERSION, items }, changes, baseline };
}
