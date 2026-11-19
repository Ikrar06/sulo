import { describe, expect, it } from 'vitest';
import { HELD_BACK_SEC, sleepHelpDue } from '@sulo/core/watch/sleep-help';

const late = (by: number, at = 10_000) => ({ plannedAt: at, ranAt: at + by });

describe('sleep help (phone holding checks back)', () => {
  it('needs two late checks in a row', () => {
    expect(sleepHelpDue([])).toBe(false);
    expect(sleepHelpDue([late(HELD_BACK_SEC + 60)])).toBe(false);
    expect(sleepHelpDue([late(HELD_BACK_SEC + 60), late(HELD_BACK_SEC + 1)])).toBe(true);
  });
  it('an on-time check in between resets it; exactly two hours is not late', () => {
    expect(sleepHelpDue([late(HELD_BACK_SEC + 60), late(60), late(HELD_BACK_SEC + 60)])).toBe(false);
    expect(sleepHelpDue([late(HELD_BACK_SEC), late(HELD_BACK_SEC)])).toBe(false);
  });
});
