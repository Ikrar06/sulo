import { describe, expect, it } from 'vitest';
import { attendanceSpread } from '@sulo/core/presensi/service';

const row = (courseId: number, got: number, max: number, taken = 1) => ({ courseId, cmid: courseId + 1000, taken, points: { got, max }, percent: max > 0 ? Math.round((got / max) * 1000) / 10 : null });

describe('attendance spread (whether "Terendah" shows)', () => {
  it('needs two courses with sessions at different percents', () => {
    expect(attendanceSpread([row(1, 11, 14), row(2, 14, 14)])).toBe(true);
  });
  it('all the same, even before rounding: no lowest', () => {
    expect(attendanceSpread([row(1, 11, 14), row(2, 22, 28)])).toBe(false);
  });
  it('one course with data, or none: no lowest', () => {
    expect(attendanceSpread([row(1, 11, 14), row(2, 0, 0, 0)])).toBe(false);
    expect(attendanceSpread([])).toBe(false);
    expect(attendanceSpread(undefined)).toBe(false);
  });
});
