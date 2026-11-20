// Owner's one-off development exception (20 Nov 2026, docs/ATURAN-REQUEST.md):
// up to 40 POST above the hard limit, for the staged session checks only
// (core_session_time_remaining, one call per POST), on the day the flag was
// set, in debug builds only. Release builds never get past `dev`; the user's
// limits (150 POST, 1000 calls) do not change.

import { DAILY_BUDGET } from '@sulo/core/moodle/limits';

export const TEST_BUDGET_EXTRA = 40;
/** The flag: the local date it was set for (it lapses at midnight). */
export const TEST_BUDGET_FLAG = 'sulo:dev:testBudget';
/** At least this long between two test checks. */
export const TEST_CHECK_GAP_MS = 10_000;

/** The daily POST limit for the staged session check. */
export function testCheckLimit(o: { dev: boolean; flagDate: string | null; today: string }): number {
  return o.dev && o.flagDate === o.today ? DAILY_BUDGET + TEST_BUDGET_EXTRA : DAILY_BUDGET;
}

/** How many of the 40 are used today ("anggaran uji n/40"). */
export const testBudgetUsed = (usedToday: number): number => Math.min(TEST_BUDGET_EXTRA, Math.max(0, usedToday - DAILY_BUDGET));
