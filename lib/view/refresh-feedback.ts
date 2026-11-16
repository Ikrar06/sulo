// What a click on "Perbarui" tells the user when Sulo sends nothing. Pure.
// Within the 2-minute cooldown, at the hard daily limit or while backing
// off, no request goes out; if the data is less than 12 hours old the
// button just says "Sudah terbaru". Older data is left to the status notice.

import { STALE_WARNING_H } from '../moodle/limits';
import type { SyncOutcome, UnixSeconds } from '../types';

/** Reasons a click sends nothing; none of them is ever named to the user. */
const QUIET_SKIPS = new Set(['FRESH', 'BUDGET_EXHAUSTED', 'BACKING_OFF']);

export function refreshFeedback(outcome: SyncOutcome | null, lastSyncAt: UnixSeconds | null, now: UnixSeconds): 'up-to-date' | null {
  if (!outcome || outcome.status !== 'skipped' || !QUIET_SKIPS.has(outcome.reason)) return null;
  if (lastSyncAt === null || now - lastSyncAt >= STALE_WARNING_H * 3600) return null;
  return 'up-to-date';
}

/** The refresh icon turns once (300 ms) when a click sends nothing. */
export const QUIET_SPIN_MS = 300;
/** How long "Sudah terbaru" stays. */
export const UP_TO_DATE_MS = 2000;
