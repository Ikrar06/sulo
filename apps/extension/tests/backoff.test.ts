import { describe, expect, it } from 'vitest';
import { afterFailure, backoffDelaySeconds, isBackingOff, parseRetryAfter } from '@sulo/core/moodle/backoff';

const H = 3600;
const NOW = 1_794_000_000;

describe('backoff sequence', () => {
  it('waits 3, 6, 12 hours, then 24 hours for the 4th failure and later', () => {
    expect([1, 2, 3, 4, 5, 9].map(backoffDelaySeconds)).toEqual([3 * H, 6 * H, 12 * H, 24 * H, 24 * H, 24 * H]);
    expect(backoffDelaySeconds(0)).toBe(0);
  });

  it('accumulates failures across calls', () => {
    let state = { failures: 0, nextAllowedAt: 0 };
    const waits: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      state = afterFailure(state, NOW);
      waits.push(state.nextAllowedAt - NOW);
    }
    expect(waits).toEqual([3 * H, 6 * H, 12 * H, 24 * H]);
    expect(state.failures).toBe(4);
  });

  it('lets Retry-After lengthen but never shorten the wait, capped at 24 h', () => {
    expect(afterFailure({ failures: 0, nextAllowedAt: 0 }, NOW, 60).nextAllowedAt).toBe(NOW + 3 * H);
    expect(afterFailure({ failures: 0, nextAllowedAt: 0 }, NOW, 10 * H).nextAllowedAt).toBe(NOW + 10 * H);
    expect(afterFailure({ failures: 0, nextAllowedAt: 0 }, NOW, 99 * H).nextAllowedAt).toBe(NOW + 24 * H);
  });

  it('reports backing off only before nextAllowedAt', () => {
    expect(isBackingOff({ failures: 1, nextAllowedAt: NOW + 1 }, NOW)).toBe(true);
    expect(isBackingOff({ failures: 1, nextAllowedAt: NOW }, NOW)).toBe(false);
    expect(isBackingOff({ failures: 0, nextAllowedAt: 0 }, NOW)).toBe(false);
  });
});

describe('parseRetryAfter', () => {
  it('reads delta seconds and HTTP dates', () => {
    expect(parseRetryAfter('120', NOW)).toBe(120);
    expect(parseRetryAfter(new Date((NOW + 600) * 1000).toUTCString(), NOW)).toBe(600);
  });

  it('returns null for missing or garbage values', () => {
    expect(parseRetryAfter(null, NOW)).toBeNull();
    expect(parseRetryAfter('soon', NOW)).toBeNull();
  });
});
