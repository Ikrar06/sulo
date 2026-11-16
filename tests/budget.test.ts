import { describe, expect, it } from 'vitest';
import { BUDGET_KEY, loopPaused, readBudget, reserveRequest } from '../lib/moodle/budget';
import { DAILY_BUDGET, DAILY_CALL_BUDGET, LOOP_GUARD, SOFT_DAILY_POSTS } from '../lib/moodle/limits';
import type { Clock } from '../lib/types';
import { fixedClock, memoryStore } from './helpers';

/** A clock whose time can move, for the loop guard. */
function movingClock(start = 1_794_000_000): Clock & { advance(sec: number): void } {
  const base = fixedClock();
  let now = start;
  return { ...base, now: () => now, advance: (sec) => void (now += sec) };
}

describe('daily budget', () => {
  it('limits: soft 80 POSTs, hard 150 POSTs and 1000 calls a day', () => {
    expect(SOFT_DAILY_POSTS).toBe(80);
    expect(DAILY_BUDGET).toBe(150);
    expect(DAILY_CALL_BUDGET).toBe(1000);
  });

  it(`allows ${DAILY_BUDGET} requests and refuses the next one (spread out, so the loop guard stays quiet)`, async () => {
    const store = memoryStore();
    const clock = movingClock();
    for (let i = 0; i < DAILY_BUDGET; i += 1) {
      expect(await reserveRequest(store, clock)).toBe(true);
      clock.advance(60);
    }
    expect(await reserveRequest(store, clock)).toBe(false);
    expect((await readBudget(store, clock)).used).toBe(DAILY_BUDGET);
  });

  it('resets when the local date changes', async () => {
    const store = memoryStore({ [BUDGET_KEY]: { date: '2026-11-13', used: DAILY_BUDGET } });
    const clock = fixedClock('2026-11-13');
    expect(await reserveRequest(store, clock)).toBe(false);
    clock.setDate('2026-11-14');
    expect(await reserveRequest(store, clock)).toBe(true);
    expect(store.dump()[BUDGET_KEY]).toEqual({ date: '2026-11-14', used: 1, bySource: { manual: 1 }, withCourseList: 0, recent: [clock.now()] });
  });

  it('survives a restart because the count is read from storage', async () => {
    const store = memoryStore();
    const clock = fixedClock();
    await reserveRequest(store, clock);
    await reserveRequest(store, clock);
    const restarted = memoryStore(store.dump());
    expect((await readBudget(restarted, clock)).used).toBe(2);
  });

  it('counts requests per source and those that carried the course list', async () => {
    const store = memoryStore();
    const clock = fixedClock();
    await reserveRequest(store, clock, DAILY_BUDGET, 'background', true);
    await reserveRequest(store, clock, DAILY_BUDGET, 'background');
    await reserveRequest(store, clock, DAILY_BUDGET, 'popup');
    expect(await readBudget(store, clock)).toMatchObject({ date: '2026-11-13', used: 3, bySource: { background: 2, popup: 1 }, withCourseList: 1 });
  });
});

describe('loop guard', () => {
  it(`more than ${LOOP_GUARD.posts} POSTs within 5 minutes pauses every request for 30 minutes`, async () => {
    const store = memoryStore();
    const clock = movingClock();
    for (let i = 0; i < LOOP_GUARD.posts; i += 1) {
      expect(await reserveRequest(store, clock)).toBe(true);
      clock.advance(20);
    }
    expect(await reserveRequest(store, clock)).toBe(false);
    expect(loopPaused(await readBudget(store, clock), clock.now())).toBe(true);
    clock.advance(LOOP_GUARD.pauseSec - 1);
    expect(await reserveRequest(store, clock)).toBe(false);
    clock.advance(1);
    expect(await reserveRequest(store, clock)).toBe(true);
  });

  it('ten POSTs spread over more than 5 minutes never trip it', async () => {
    const store = memoryStore();
    const clock = movingClock();
    for (let i = 0; i < 30; i += 1) {
      expect(await reserveRequest(store, clock)).toBe(true);
      clock.advance(31);
    }
  });
});
