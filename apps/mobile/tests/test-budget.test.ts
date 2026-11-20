import { describe, expect, it } from 'vitest';
import { DAILY_BUDGET } from '@sulo/core/moodle/limits';
import { TEST_BUDGET_EXTRA, testBudgetUsed, testCheckLimit } from '../src/dev/test-budget';

describe("the owner's one-off test budget (20 Nov 2026)", () => {
  it('a release build refuses the flag: the hard limit stays', () => {
    expect(testCheckLimit({ dev: false, flagDate: '2026-11-20', today: '2026-11-20' })).toBe(DAILY_BUDGET);
  });

  it('a debug build gets 40 more on the day the flag was set only', () => {
    expect(testCheckLimit({ dev: true, flagDate: '2026-11-20', today: '2026-11-20' })).toBe(DAILY_BUDGET + 40);
    expect(testCheckLimit({ dev: true, flagDate: '2026-11-20', today: '2026-11-21' })).toBe(DAILY_BUDGET);
    expect(testCheckLimit({ dev: true, flagDate: null, today: '2026-11-20' })).toBe(DAILY_BUDGET);
  });

  it('counts what is used above the hard limit, at most 40', () => {
    expect(testBudgetUsed(DAILY_BUDGET - 3)).toBe(0);
    expect(testBudgetUsed(DAILY_BUDGET + 7)).toBe(7);
    expect(testBudgetUsed(DAILY_BUDGET + 99)).toBe(TEST_BUDGET_EXTRA);
  });
});
