import { describe, expect, it } from 'vitest';
import { refreshFeedback } from '@sulo/core/view/refresh-feedback';

const NOW = 1_794_000_000;
const H = 3600;

describe('refreshFeedback', () => {
  it('"Sudah terbaru" when a click sent nothing (cooldown, hard limit, backoff) and data is under 12 hours old', () => {
    for (const reason of ['FRESH', 'BUDGET_EXHAUSTED', 'BACKING_OFF'] as const) expect(refreshFeedback({ status: 'skipped', reason }, NOW - 60, NOW)).toBe('up-to-date');
    expect(refreshFeedback({ status: 'skipped', reason: 'FRESH' }, NOW - 12 * H + 1, NOW)).toBe('up-to-date');
  });
  it('nothing when the data is 12 hours old or more (the status notice speaks then)', () => {
    expect(refreshFeedback({ status: 'skipped', reason: 'BACKING_OFF' }, NOW - 12 * H, NOW)).toBeNull();
    expect(refreshFeedback({ status: 'skipped', reason: 'FRESH' }, null, NOW)).toBeNull();
  });
  it('nothing after a real sync or another kind of refusal', () => {
    expect(refreshFeedback({ status: 'ok', at: NOW, tasks: 3, courseListFetched: false }, NOW, NOW)).toBeNull();
    expect(refreshFeedback({ status: 'skipped', reason: 'SESSION_EXPIRED' }, NOW - 60, NOW)).toBeNull();
    expect(refreshFeedback(null, NOW - 60, NOW)).toBeNull();
  });
});
