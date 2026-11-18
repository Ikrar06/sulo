import { describe, expect, it } from 'vitest';
import { showInvite } from '../lib/neosia/invite';
import { classesToday } from '../lib/neosia/today';
import type { ClassMeeting } from '../lib/neosia/view';

const m = (weekday: number, start: string, end: string, name = 'X'): ClassMeeting => ({ code: null, name, shortName: null, className: null, sks: 2, weekday, start, end, room: null, lecturers: [] });

describe('Kuliah hari ini', () => {
  // 2026-11-16 is a Monday.
  const meetings = [m(1, '07:30', '10:00', 'pagi'), m(1, '13:00', '14:40', 'siang'), m(2, '08:00', '10:00', 'selasa')];
  it("lists today's classes, hiding those already over", () => {
    expect(classesToday(meetings, '2026-11-16', 9 * 60, []).map((x) => x.name)).toEqual(['pagi', 'siang']);
    expect(classesToday(meetings, '2026-11-16', 10 * 60, []).map((x) => x.name)).toEqual(['siang']);
    expect(classesToday(meetings, '2026-11-16', 15 * 60, [])).toEqual([]);
  });
  it('shows nothing on an academic-calendar holiday', () => {
    expect(classesToday(meetings, '2026-11-16', 6 * 60, [{ mulai: '2026-11-16', selesai: '2026-11-16', nama: 'Libur' }])).toEqual([]);
  });
});

describe('NEOSIA invite card', () => {
  const DAY = 86_400;
  const base = { moduleOn: false, dismissedAt: null, now: 100 * DAY, today: '2026-11-18', krsWindows: [{ mulai: '2027-01-03', selesai: '2027-02-12' }], dismissedDay: null };
  it('shows while the module is off and it was never dismissed; never while on', () => {
    expect(showInvite(base)).toBe(true);
    expect(showInvite({ ...base, moduleOn: true })).toBe(false);
  });
  it('"Nanti saja" hides it for 30 days', () => {
    expect(showInvite({ ...base, dismissedAt: base.now - 29 * DAY, dismissedDay: '2026-10-20' })).toBe(false);
    expect(showInvite({ ...base, dismissedAt: base.now - 30 * DAY, dismissedDay: '2026-10-19' })).toBe(true);
  });
  it('comes back 14 days before a KRS window, unless dismissed again since then', () => {
    expect(showInvite({ ...base, today: '2026-12-20', dismissedAt: base.now - 5 * DAY, dismissedDay: '2026-12-15' })).toBe(true);
    expect(showInvite({ ...base, today: '2026-12-22', dismissedAt: base.now - 1 * DAY, dismissedDay: '2026-12-21' })).toBe(false);
    expect(showInvite({ ...base, today: '2026-12-19', dismissedAt: base.now - 5 * DAY, dismissedDay: '2026-12-14' })).toBe(false);
  });
});
