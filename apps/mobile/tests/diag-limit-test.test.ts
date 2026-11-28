import { describe, expect, it } from 'vitest';
import { longestGapMin, pingCounted } from '../src/diag/limit-test';

describe('Diagnostik: SIKOLA limit test', () => {
  it('counts the ping as activity only when the time left came back up', () => {
    expect(pingCounted(28_000, 28_790)).toBe(true);
    expect(pingCounted(28_000, 27_990)).toBe(false);
    // A small rise (rounding, a second request in between) is not enough.
    expect(pingCounted(28_000, 28_100)).toBe(false);
  });

  it('finds the longest gap between background checks in the last 24 hours', () => {
    const now = 100_000;
    expect(longestGapMin([], now)).toBeNull();
    expect(longestGapMin([{ ranAt: now - 60 }], now)).toBeNull();
    expect(longestGapMin([{ ranAt: now - 7200 }, { ranAt: now - 600 }, { ranAt: now - 3600 }], now)).toBe(60);
    // Older than a day: left out; zero (never ran): left out.
    expect(longestGapMin([{ ranAt: now - 90_000 }, { ranAt: now - 1200 }, { ranAt: now - 600 }, { ranAt: 0 }], now)).toBe(10);
  });
});
