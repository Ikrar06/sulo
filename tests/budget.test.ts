import { describe, expect, it } from 'vitest';
import { BUDGET_KEY, readBudget, reserveRequest } from '../lib/moodle/budget';
import { DAILY_BUDGET } from '../lib/moodle/limits';
import { fixedClock, memoryStore } from './helpers';

describe('daily budget', () => {
  it(`allows ${DAILY_BUDGET} requests and refuses the next one`, async () => {
    const store = memoryStore();
    const clock = fixedClock();
    for (let i = 0; i < DAILY_BUDGET; i += 1) {
      expect(await reserveRequest(store, clock)).toBe(true);
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
    expect(store.dump()[BUDGET_KEY]).toEqual({ date: '2026-11-14', used: 1 });
  });

  it('survives a restart because the count is read from storage', async () => {
    const store = memoryStore();
    const clock = fixedClock();
    await reserveRequest(store, clock);
    await reserveRequest(store, clock);
    const restarted = memoryStore(store.dump());
    expect((await readBudget(restarted, clock)).used).toBe(2);
  });
});
