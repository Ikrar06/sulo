import { STALE_WARNING_H } from './moodle/limits';
import type { UnixSeconds } from './types';

/** Whole hours since the last successful sync, or null if there never was one. */
export function hoursSince(lastSyncAt: UnixSeconds | null, now: UnixSeconds): number | null {
  if (lastSyncAt === null || lastSyncAt <= 0) return null;
  return Math.max(0, Math.floor((now - lastSyncAt) / 3600));
}

/**
 * Data is stale when the last sync is older than STALE_WARNING_H, or when
 * there has never been one. The UI must then say so instead of implying
 * that an empty list means "no tasks" (docs/ARCHITECTURE.md, section 5).
 */
export function isStale(lastSyncAt: UnixSeconds | null, now: UnixSeconds, thresholdHours = STALE_WARNING_H): boolean {
  if (lastSyncAt === null || lastSyncAt <= 0) return true;
  return now - lastSyncAt > thresholdHours * 3600;
}
