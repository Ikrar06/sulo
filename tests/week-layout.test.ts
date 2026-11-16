import { describe, expect, it } from 'vitest';
import { calendarEvents, DEFAULT_GROUP_FILTER, eventsOnDay, GROUP_OF_KATEGORI, upcomingEvents, type CalEvent } from '../lib/calendar/groups';
import { KATEGORI } from '../lib/calendar/schema';
import { layoutWeek, periodAt } from '../lib/calendar/week-layout';
import { bundledCalendar } from '../lib/calendar/remote';

const ev = (id: string, start: string, end: string, period = false): CalEvent => ({
  id,
  group: 'akademik',
  title: id,
  start,
  end,
  period,
  source: { type: 'libur', libur: { id, nama: id, mulai: start, selesai: end, jenis: 'libur_nasional', status_verifikasi: 'cocok_pdf', catatan: null } as never },
});

// Monday 16 Nov 2026 .. Sunday 22 Nov 2026.
const WEEK = '2026-11-16';

describe('layoutWeek', () => {
  it('an event across weeks is clipped to Monday..Sunday with square ends where it continues', () => {
    const { bars } = layoutWeek([ev('a', '2026-11-12', '2026-11-25')], WEEK);
    expect(bars).toEqual([expect.objectContaining({ startCol: 0, span: 7, lane: 0, continuesBefore: true, continuesAfter: true })]);
    const next = layoutWeek([ev('a', '2026-11-12', '2026-11-25')], '2026-11-23').bars[0];
    expect(next).toEqual(expect.objectContaining({ startCol: 0, span: 3, continuesBefore: true, continuesAfter: false }));
  });

  it('an event across months is one bar in the week it shares', () => {
    const { bars } = layoutWeek([ev('b', '2026-11-28', '2026-12-02')], '2026-11-23');
    expect(bars[0]).toEqual(expect.objectContaining({ startCol: 5, span: 2, continuesBefore: false, continuesAfter: true }));
    const dec = layoutWeek([ev('b', '2026-11-28', '2026-12-02')], '2026-11-30').bars[0];
    expect(dec).toEqual(expect.objectContaining({ startCol: 0, span: 3, continuesBefore: true, continuesAfter: false }));
  });

  it('overlapping events take separate lanes: by start, then the longest first; a free lane is reused', () => {
    const { bars } = layoutWeek([ev('short', '2026-11-17', '2026-11-17'), ev('long', '2026-11-17', '2026-11-20'), ev('later', '2026-11-21', '2026-11-22'), ev('first', '2026-11-16', '2026-11-16')], WEEK);
    const lane = Object.fromEntries(bars.map((b) => [b.event.id, b.lane]));
    expect(lane).toEqual({ first: 0, long: 0, short: 1, later: 0 });
  });

  it('beyond three lanes events are hidden and counted per day', () => {
    const many = [1, 2, 3, 4, 5].map((i) => ev(`e${i}`, '2026-11-18', i === 5 ? '2026-11-19' : '2026-11-18'));
    const { bars, hidden } = layoutWeek(many, WEEK);
    expect(bars).toHaveLength(3);
    // The two-day event is the longest, so it is placed first and keeps a lane; two one-day events on Wednesday do not fit.
    expect(bars.map((b) => b.event.id)).toContain('e5');
    expect(hidden).toEqual([0, 0, 2, 0, 0, 0, 0]);
    // A fourth event only on Thursday still fits: Thursday has two free lanes.
    expect(layoutWeek([...many, ev('thu', '2026-11-19', '2026-11-19')], WEEK).hidden).toEqual([0, 0, 2, 0, 0, 0, 0]);
  });

  it('status periods are not bars: they tint the covered days', () => {
    const layout = layoutWeek([ev('libur', '2026-11-19', '2026-12-31', true), ev('x', '2026-11-19', '2026-11-19')], WEEK);
    expect(layout.bars.map((b) => b.event.id)).toEqual(['x']);
    expect(layout.periods).toEqual([expect.objectContaining({ startCol: 3, span: 4 })]);
    expect(periodAt(layout, 2)).toBeNull();
    expect(periodAt(layout, 5)?.event.id).toBe('libur');
  });

  it('events outside the week are ignored', () => {
    expect(layoutWeek([ev('old', '2026-11-01', '2026-11-15')], WEEK)).toEqual({ bars: [], hidden: [0, 0, 0, 0, 0, 0, 0], periods: [] });
  });
});

describe('calendar groups', () => {
  it('every category has a group', () => {
    for (const k of KATEGORI) expect(GROUP_OF_KATEGORI[k]).toBeDefined();
  });

  it('admissions are off by default; turning a group off removes its events; tasks are one-day events', () => {
    const cal = bundledCalendar();
    const all = calendarEvents(cal, [], DEFAULT_GROUP_FILTER);
    expect(all.some((e) => e.group === 'penerimaan')).toBe(false);
    expect(calendarEvents(cal, [], { ...DEFAULT_GROUP_FILTER, ujian: false }).some((e) => e.group === 'ujian')).toBe(false);
    const withTask = calendarEvents(cal, [{ eventId: 9, name: 'Tugas', courseName: 'Contoh', courseColor: 2, dueAt: 0, dateKey: '2026-11-20' }], DEFAULT_GROUP_FILTER);
    expect(eventsOnDay(withTask, '2026-11-20').at(-1)).toEqual(expect.objectContaining({ group: 'tugas', start: '2026-11-20', end: '2026-11-20' }));
  });

  it('upcoming: events starting today or later, nearest first, no tasks', () => {
    const cal = bundledCalendar();
    const next = upcomingEvents(calendarEvents(cal, [], DEFAULT_GROUP_FILTER), '2026-11-16');
    expect(next).toHaveLength(5);
    expect(next.every((e) => e.start >= '2026-11-16' && e.source.type !== 'tugas')).toBe(true);
    expect([...next].map((e) => e.start)).toEqual([...next.map((e) => e.start)].sort());
  });
});
