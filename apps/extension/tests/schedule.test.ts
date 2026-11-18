import { describe, expect, it } from 'vitest';
import { backgroundBlockReason, isQuietHour } from '@sulo/core/schedule';
import { hoursSince, isStale } from '@sulo/core/staleness';
import { fixedClock } from './helpers';

describe('quiet hours and idle', () => {
  it('treats 00.00 to 05.59 local time as quiet', () => {
    expect([0, 3, 5].every((h) => isQuietHour(h))).toBe(true);
    expect([6, 12, 23].some((h) => isQuietHour(h))).toBe(false);
  });

  it('supports ranges that wrap past midnight', () => {
    expect(isQuietHour(23, { startHour: 22, endHour: 6 })).toBe(true);
    expect(isQuietHour(7, { startHour: 22, endHour: 6 })).toBe(false);
  });

  it('blocks background sync during quiet hours even when active', () => {
    expect(backgroundBlockReason(fixedClock('2026-11-13', 2), 'active')).toBe('QUIET_HOURS');
  });

  it('blocks background sync when idle or locked', () => {
    expect(backgroundBlockReason(fixedClock('2026-11-13', 10), 'idle')).toBe('IDLE');
    expect(backgroundBlockReason(fixedClock('2026-11-13', 10), 'locked')).toBe('IDLE');
  });

  it('allows background sync when active outside quiet hours', () => {
    expect(backgroundBlockReason(fixedClock('2026-11-13', 10), 'active')).toBeNull();
  });
});

describe('staleness', () => {
  const NOW = 1_794_000_000;
  it('is stale with no sync at all', () => {
    expect(isStale(null, NOW)).toBe(true);
    expect(hoursSince(null, NOW)).toBeNull();
  });
  it('is stale only beyond 12 hours', () => {
    expect(isStale(NOW - 12 * 3600, NOW)).toBe(false);
    expect(isStale(NOW - 12 * 3600 - 1, NOW)).toBe(true);
    expect(hoursSince(NOW - 7 * 3600 - 5, NOW)).toBe(7);
  });
});
