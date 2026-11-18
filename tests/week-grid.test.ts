import { describe, expect, it } from 'vitest';
import { gridDays, gridRange, lanes } from '../lib/neosia/week-grid';

const m = (start: string, end: string, weekday = 1) => ({ start, end, weekday });

describe('Jadwal time grid', () => {
  it('spans an hour around the classes on whole hours, at least 07.00 to 17.00', () => {
    expect(gridRange([])).toEqual({ start: 420, end: 1020 });
    expect(gridRange([m('09:00', '11:00')])).toEqual({ start: 420, end: 1020 });
    expect(gridRange([m('07:30', '10:00'), m('16:20', '18:10')])).toEqual({ start: 360, end: 1200 });
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
