import type { BudgetState, Clock, KeyValueStore, RequestSource } from '../types';
import { DAILY_BUDGET, DAILY_CALL_BUDGET } from './limits';

export const BUDGET_KEY = 'global:budget';

/** Budget for the current local day. A stored state from another day counts as zero. */
export async function readBudget(store: KeyValueStore, clock: Clock): Promise<BudgetState> {
  const today = clock.localDate();
  const stored = await store.get<BudgetState>(BUDGET_KEY);
  if (!stored || stored.date !== today) return { date: today, used: 0 };
  return stored;
}

/** What is left today: requests (POST and GET) and Moodle function calls. */
export function remainingQuota(
  state: BudgetState,
  limits: { requests: number; calls: number } = { requests: DAILY_BUDGET, calls: DAILY_CALL_BUDGET },
): { posts: number; calls: number } {
  return { posts: Math.max(0, limits.requests - state.used), calls: Math.max(0, limits.calls - (state.calls ?? 0)) };
}

/**
 * Reserves one request from the daily budget and persists it before the
 * request is sent, so the count survives a service worker restart.
 * A batch also reserves its function calls (`calls`), counted separately.
 * Callers must serialize calls (the client queue does) to avoid lost updates.
 */
export async function reserveRequest(
  store: KeyValueStore,
  clock: Clock,
  limit: number = DAILY_BUDGET,
  source: RequestSource = 'manual',
  withCourseList = false,
  calls = 0,
  callLimit: number = DAILY_CALL_BUDGET,
): Promise<boolean> {
  const current = await readBudget(store, clock);
  if (current.used >= limit) return false;
  if (calls > 0 && (current.calls ?? 0) + calls > callLimit) return false;
  const bySource = { ...current.bySource, [source]: (current.bySource?.[source] ?? 0) + 1 };
  const next: BudgetState = {
    date: current.date,
    used: current.used + 1,
    bySource,
    withCourseList: (current.withCourseList ?? 0) + (withCourseList ? 1 : 0),
    ...(calls > 0 || current.calls !== undefined ? { calls: (current.calls ?? 0) + calls } : {}),
  };
  await store.set<BudgetState>(BUDGET_KEY, next);
  return true;
}
