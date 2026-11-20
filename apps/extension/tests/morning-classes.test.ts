// The phone's morning summary with NEOSIA's schedule (M8e 0c): "Kuliah hari
// ini" lists today's classes by name and start time, only when the schedule
// is there and today has classes, never on a holiday, never a grade.
import { describe, expect, it } from 'vitest';
import { en } from '@sulo/core/i18n/en';
import { id } from '@sulo/core/i18n/id';
import { morningCounts, morningFullView } from '@sulo/core/reminders/morning';
import { planReminders } from '@sulo/core/reminders/plan';
import { DEFAULT_REMINDERS } from '@sulo/core/reminders/settings';
import { zonedToUnix } from '@sulo/core/reminders/zoned';
import type { Task } from '@sulo/core/types';

const TZ = 'Asia/Makassar';
const NOW = zonedToUnix('2026-11-19', 7 * 60, TZ); // Thursday (weekday 4) 07.00
const H = 3600;
const task = (eventId: number, dueAt: number): Task => ({ eventId, cmId: null, courseId: 1, name: `Tugas ${eventId}`, module: 'assign', dueAt, url: '', overdue: false, firstSeenAt: NOW, lastSeenAt: NOW, missingSince: null });
const meeting = (name: string, weekday: number, start: string, end: string) => ({ name, weekday, start, end });
const base = { now: NOW, timeZone: TZ, taskState: {}, activeCourseIds: new Set([1]), settings: { ...DEFAULT_REMINDERS, morning: { enabled: true, atMin: 7 * 60 } }, sent: {}, session: { state: 'OK' as const, expiredAt: null }, morningStyle: 'full' as const };
const morningOf = (plan: ReturnType<typeof planReminders>) => {
  const m = plan.send.find((n) => n.kind === 'morning');
  return m && 'full' in m ? m.full : null;
};

describe('Kuliah hari ini in the morning summary', () => {
  it('lists today\'s classes by start, in both languages, after the task counts', () => {
    const c = morningCounts(NOW, TZ, [task(1, NOW - H)], [], [
      { name: 'Mekanika Fluida B', start: '07:30' },
      { name: 'Hidrologi', start: '10:10' },
    ]);
    expect(morningFullView(c!, id).message).toBe('1 tugas terlambat. Kuliah hari ini: Mekanika Fluida B 07:30, Hidrologi 10:10.');
    expect(morningFullView(c!, en).message).toBe('1 overdue. Classes today: Mekanika Fluida B 07:30, Hidrologi 10:10.');
  });

  it('more than three: the first three and how many more', () => {
    const c = morningCounts(NOW, TZ, [], [], ['A', 'B', 'C', 'D', 'E'].map((name, i) => ({ name, start: `0${i + 7}:00` })));
    expect(morningFullView(c!, id).message).toBe('Kuliah hari ini: A 07:00, B 08:00, C 09:00, dan 2 lainnya.');
    expect(morningFullView(c!, en).message).toBe('Classes today: A 07:00, B 08:00, C 09:00 and 2 more.');
  });

  it('the planner takes only today\'s weekday, sorted by start', () => {
    const plan = planReminders({ ...base, tasks: [], classes: { meetings: [meeting('Etika', 4, '13:00', '14:40'), meeting('Fluida', 4, '07:30', '09:10'), meeting('Senin saja', 1, '07:30', '10:00')], holidays: [] } });
    expect(morningOf(plan)?.classes).toEqual([
      { name: 'Fluida', start: '07:30' },
      { name: 'Etika', start: '13:00' },
    ]);
  });

  it('no schedule, no class today, or a holiday: no line (and no summary when nothing else is there)', () => {
    expect(morningOf(planReminders({ ...base, tasks: [] }))).toBeNull();
    expect(morningOf(planReminders({ ...base, tasks: [], classes: { meetings: [meeting('Senin saja', 1, '07:30', '10:00')], holidays: [] } }))).toBeNull();
    const holiday = planReminders({ ...base, tasks: [task(1, NOW - H)], classes: { meetings: [meeting('Fluida', 4, '07:30', '09:10')], holidays: [{ mulai: '2026-11-19', selesai: '2026-11-19', nama: 'Libur' }] } });
    expect(morningOf(holiday)).toEqual({ overdue: 1, today: 0, tomorrow: 0, events: [] });
  });

  it('never a grade: only names and times reach the text', () => {
    const view = morningFullView({ overdue: 0, today: 0, tomorrow: 0, events: [], classes: [{ name: 'Fluida', start: '07:30' }] }, id);
    expect(view.message).not.toMatch(/IPK|IPS|nilai|\b[A-E][+-]?\b(?! ?\d)/);
  });
});
