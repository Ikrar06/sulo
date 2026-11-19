import { describe, expect, it } from 'vitest';
import { BUDGET_KEY, readBudget, remainingQuota, reserveRequest, restKind } from '@sulo/core/moodle/budget';
import { ACTIVE_RESERVE, DAILY_BUDGET, DAILY_CALL_BUDGET, LOOP_GUARD, QUOTA_LOW, QUOTA_LOWER, QUOTA_LOWEST, SOFT_DAILY_POSTS, WATCH_STOP } from '@sulo/core/moodle/limits';
import { partsToDrop } from '@sulo/core/sync/plan-batch';
import { reserve, watchStopped } from '@sulo/core/watch/check';
import type { BudgetState, Clock } from '@sulo/core/types';
import { fixedClock, memoryStore } from './helpers';

const plan = {
  budget: { softPosts: SOFT_DAILY_POSTS, watchStopPosts: WATCH_STOP.posts, watchStopCalls: WATCH_STOP.calls, hardPosts: DAILY_BUDGET, callLimit: DAILY_CALL_BUDGET, loopPosts: LOOP_GUARD.posts, loopWindowSec: LOOP_GUARD.windowSec, loopPauseSec: LOOP_GUARD.pauseSec },
};

function movingClock(start = 1_794_000_000): Clock & { advance(sec: number): void } {
  const base = fixedClock();
  let now = start;
  return { ...base, now: () => now, advance: (sec) => void (now += sec) };
}

describe('the active-use reserve', () => {
  it('watching stops at 100 POST or 700 calls, leaving 50 POST and 300 calls', () => {
    expect(WATCH_STOP).toEqual({ posts: 100, calls: 700 });
    expect(ACTIVE_RESERVE).toEqual({ posts: 50, calls: 300 });
    expect(SOFT_DAILY_POSTS).toBeLessThan(WATCH_STOP.posts);
  });

  it('a manual sync is never trimmed while more than the reserve is left', () => {
    for (const t of [QUOTA_LOW, QUOTA_LOWER, QUOTA_LOWEST]) {
      expect(t.posts).toBeLessThanOrEqual(ACTIVE_RESERVE.posts);
      expect(t.calls).toBeLessThanOrEqual(ACTIVE_RESERVE.calls);
    }
    expect(partsToDrop(ACTIVE_RESERVE)).toEqual([]);
    expect(partsToDrop({ posts: ACTIVE_RESERVE.posts + 1, calls: ACTIVE_RESERVE.calls + 1 })).toEqual([]);
    // Only deep inside the reserve: course structures first.
    expect(partsToDrop({ posts: 9, calls: 300 })).toEqual(['structure']);
  });

  it('a heavy day of active use (60 POST) can still Perbarui up to the hard limit', async () => {
    const store = memoryStore();
    const clock = movingClock();
    // Spaced out so the loop guard (10 in 5 minutes) never trips.
    const step = Math.ceil(LOOP_GUARD.windowSec / LOOP_GUARD.posts) + 1;
    const manual = async () => {
      clock.advance(step);
      return reserveRequest(store, clock, DAILY_BUDGET, 'manual', false, 6);
    };
    for (let i = 0; i < 60; i++) expect(await manual()).toBe(true);

    // The phone watches in the background until the watch stop.
    let watched = 0;
    for (;;) {
      clock.advance(step);
      const state = await store.get<BudgetState>(BUDGET_KEY);
      const r = reserve(state ?? null, clock.localDate(), clock.now(), 3, plan);
      await store.set(BUDGET_KEY, r.next);
      if (!r.ok) break;
      watched++;
    }
    expect(watched).toBe(40);
    const atStop = await readBudget(store, clock);
    expect(atStop.used).toBe(WATCH_STOP.posts);
    expect(watchStopped(plan, atStop.used, atStop.calls ?? 0)).toBe(true);
    // The reserve is whole: a full manual sync, nothing trimmed.
    expect(partsToDrop(remainingQuota(atStop))).toEqual([]);

    // Perbarui keeps working through the whole reserve, then the hard limit holds.
    for (let i = 0; i < ACTIVE_RESERVE.posts; i++) expect(await manual()).toBe(true);
    expect(await manual()).toBe(false);
    const end = await readBudget(store, clock);
    expect(end.used).toBe(DAILY_BUDGET);
    expect(end.bySource).toMatchObject({ manual: 110, watch: 40 });
  });

  it('tells the daily limit from the loop guard', () => {
    expect(restKind({ date: '2026-11-19', used: DAILY_BUDGET }, 100)).toBe('day');
    expect(restKind({ date: '2026-11-19', used: 20, pausedUntil: 200 }, 100)).toBe('short');
    expect(restKind({ date: '2026-11-19', used: 20, pausedUntil: 50 }, 100)).toBe('day');
  });
});
