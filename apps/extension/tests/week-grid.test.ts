import { describe, expect, it } from 'vitest';
import { blockBox, blockLayout, gridDays, gridRange, lanes } from '@sulo/core/neosia/week-grid';

const m = (start: string, end: string, weekday = 1) => ({ start, end, weekday });

describe('Jadwal time grid', () => {
  it('spans the full hour before the first class minus an hour to the full hour after the last plus an hour', () => {
    expect(gridRange([m('07:30', '10:00'), m('16:20', '18:10')])).toEqual({ start: 360, end: 1200 });
    expect(gridRange([m('07:50', '08:40'), m('13:00', '15:30')])).toEqual({ start: 360, end: 1020 });
  });
  it('is at least 4 hours, not forced to 07.00 to 17.00', () => {
    expect(gridRange([m('09:00', '10:00')])).toEqual({ start: 480, end: 720 });
    expect(gridRange([m('09:10', '09:50')])).toEqual({ start: 480, end: 720 });
  });
  it('places blocks exactly by minute (48 px an hour)', () => {
    expect(blockBox(m('07:50', '08:40'), 420)).toEqual({ top: 40, height: 40 });
    expect(blockBox(m('08:00', '09:40'), 420)).toEqual({ top: 48, height: 80 });
    expect(blockBox(m('13:00', '15:30'), 420)).toEqual({ top: 288, height: 120 });
  });
  it('fits its content to the length: 60+ tall, 40 to 59 medium, under 40 one line', () => {
    expect(blockLayout(m('08:00', '09:00'))).toBe('tall');
    expect(blockLayout(m('07:50', '08:40'))).toBe('medium');
    expect(blockLayout(m('08:00', '08:40'))).toBe('medium');
    expect(blockLayout(m('08:00', '08:39'))).toBe('short');
  });
  it('shows Sunday only when a class meets on it', () => {
    expect(gridDays([m('08:00', '09:00', 1)])).toEqual([1, 2, 3, 4, 5, 6]);
    expect(gridDays([m('08:00', '09:00', 0)])).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });
  it('puts overlapping classes side by side, others full width', () => {
    const out = lanes([m('08:00', '10:00'), m('09:00', '11:00'), m('13:00', '14:00')]);
    expect(out.map((o) => [o.meeting.start, o.lane, o.lanes])).toEqual([
      ['08:00', 0, 2],
      ['09:00', 1, 2],
      ['13:00', 0, 1],
    ]);
  });
});
