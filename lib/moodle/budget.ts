import type { BudgetState, Clock, KeyValueStore, RequestSource } from '../types';
import { DAILY_BUDGET } from './limits';

export const BUDGET_KEY = 'global:budget';

/** Budget for the current local day. A stored state from another day counts as zero. */
export async function readBudget(store: KeyValueStore, clock: Clock): Promise<BudgetState> {
  const today = clock.localDate();
  const stored = await store.get<BudgetState>(BUDGET_KEY);
  if (!stored || stored.date !== today) return { date: today, used: 0 };
  return stored;
}

/**
 * Reserves one request from the daily budget and persists it before the
 * request is sent, so the count survives a service worker restart.
 * Callers must serialize calls (the client queue does) to avoid lost updates.
 */
export async function reserveRequest(
  store: KeyValueStore,
  clock: Clock,
  limit: number = DAILY_BUDGET,
  source: RequestSource = 'manual',
  withCourseList = false,
): Promise<boolean> {
  const current = await readBudget(store, clock);
  if (current.used >= limit) return false;
  const bySource = { ...current.bySource, [source]: (current.bySource?.[source] ?? 0) + 1 };
  const next: BudgetState = {
    date: current.date,
    used: current.used + 1,
    bySource,
    withCourseList: (current.withCourseList ?? 0) + (withCourseList ? 1 : 0),
  };
  await store.set<BudgetState>(BUDGET_KEY, next);
  return true;
}
