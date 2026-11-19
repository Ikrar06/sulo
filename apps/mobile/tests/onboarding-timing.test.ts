import { describe, expect, it } from 'vitest';
import { MAX_EXTRA_MS, MIN_SHOWN_MS, prepOutcome, shownTimes } from '../src/onboarding/stage-timing';

describe('Menyiapkan Sulo: when each row shows', () => {
  it('follows the real stages when they are slow', () => {
    const out = shownTimes([
      { row: 'tasks', result: 'ok', at: 1000 },
      { row: 'courses', result: 'ok', at: 1800 },
      { row: 'calendar', result: 'ok', at: 2600 },
      { row: 'attendance', result: 'failed', at: 4000 },
    ]);
    expect(out.map((r) => r.showAt)).toEqual([1000, 1800, 2600, 4000]);
  });

  it('keeps each check readable for 250 ms when stages end at once, adding at most 1.2 s', () => {
    const out = shownTimes([
      { row: 'tasks', result: 'ok', at: 500 },
      { row: 'courses', result: 'ok', at: 500 },
      { row: 'calendar', result: 'ok', at: 500 },
      { row: 'attendance', result: 'ok', at: 500 },
    ]);
    expect(out.map((r) => r.showAt)).toEqual([500, 750, 1000, 1250]);
    for (const r of out) expect(r.showAt - 500).toBeLessThanOrEqual(MAX_EXTRA_MS);
    expect(MIN_SHOWN_MS).toBe(250);
  });

  it('stops at the first row still running', () => {
    expect(shownTimes([{ row: 'tasks', result: 'ok', at: 0 }, { row: 'calendar', result: 'ok', at: 10 }]).map((r) => r.row)).toEqual(['tasks']);
  });

  it('no tasks is a failure; another failed row is partial', () => {
    expect(prepOutcome([], false)).toBe('failed');
    expect(prepOutcome([{ row: 'tasks', result: 'failed', at: 0 }], false)).toBe('failed');
    expect(prepOutcome([{ row: 'tasks', result: 'ok', at: 0 }, { row: 'attendance', result: 'failed', at: 1 }], true)).toBe('partial');
    expect(prepOutcome([{ row: 'tasks', result: 'ok', at: 0 }, { row: 'courses', result: 'ok', at: 1 }], true)).toBe('ok');
    expect(prepOutcome([{ row: 'tasks', result: 'ok', at: 0 }], false)).toBe('partial');
  });
});
