import { describe, expect, it } from 'vitest';
import { refreshNoticeAt } from '../src/ios-refresh';
import { zonedToUnix } from '@sulo/core/reminders/zoned';

const TZ = 'Asia/Makassar';
const QUIET = { enabled: true, startMin: 22 * 60, endMin: 6 * 60 };

describe('iPhone: "Sulo perlu disegarkan besok"', () => {
  it('a day before the profile ends', () => {
    const expires = zonedToUnix('2026-12-03', 14 * 60, TZ);
    expect(refreshNoticeAt(expires, zonedToUnix('2026-11-27', 9 * 60, TZ), TZ, QUIET)).toBe(zonedToUnix('2026-12-02', 14 * 60, TZ));
  });

  it('moved out of quiet hours, never past the expiry', () => {
    const expires = zonedToUnix('2026-12-03', 23 * 60 + 30, TZ);
    // 23.30 the day before falls in quiet hours: 06.00 the next morning, still before the expiry.
    expect(refreshNoticeAt(expires, zonedToUnix('2026-11-27', 9 * 60, TZ), TZ, QUIET)).toBe(zonedToUnix('2026-12-03', 6 * 60, TZ));
    const early = zonedToUnix('2026-12-03', 3 * 60, TZ);
    // 03.00 the day before: 06.00 that same morning.
    expect(refreshNoticeAt(early, zonedToUnix('2026-11-27', 9 * 60, TZ), TZ, QUIET)).toBe(zonedToUnix('2026-12-02', 6 * 60, TZ));
  });

  it('nothing once the day before has passed', () => {
    const expires = zonedToUnix('2026-12-03', 14 * 60, TZ);
    expect(refreshNoticeAt(expires, zonedToUnix('2026-12-02', 15 * 60, TZ), TZ, QUIET)).toBeNull();
  });

  it('without quiet hours, exactly a day before', () => {
    const expires = zonedToUnix('2026-12-03', 23 * 60 + 30, TZ);
    expect(refreshNoticeAt(expires, 0, TZ, { enabled: false, startMin: 0, endMin: 0 })).toBe(expires - 86_400);
  });
});
