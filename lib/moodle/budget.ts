import type { BudgetState, Clock, KeyValueStore } from '../types';
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
): Promise<boolean> {
  const current = await readBudget(store, clock);
  if (current.used >= limit) return false;
  await store.set<BudgetState>(BUDGET_KEY, { date: current.date, used: current.used + 1 });
  return true;
}
