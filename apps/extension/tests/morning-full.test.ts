import { describe, expect, it } from 'vitest';
import { en } from '@sulo/core/i18n/en';
import { id } from '@sulo/core/i18n/id';
import { morningCounts, morningFullView } from '@sulo/core/reminders/morning';
import { planReminders } from '@sulo/core/reminders/plan';
import { DEFAULT_REMINDERS } from '@sulo/core/reminders/settings';
import { zonedToUnix } from '@sulo/core/reminders/zoned';
import type { Task } from '@sulo/core/types';

const TZ = 'Asia/Makassar';
const NOW = zonedToUnix('2026-11-19', 7 * 60, TZ); // Thursday 07.00, the default morning time
const H = 3600;
const task = (eventId: number, dueAt: number): Task => ({ eventId, cmId: null, courseId: 1, name: `Tugas ${eventId}`, module: 'assign', dueAt, url: '', overdue: false, firstSeenAt: NOW, lastSeenAt: NOW, missingSince: null });
const event = (judul: string, mulai: string, selesai: string | null = null, extra: Record<string, unknown> = {}) => ({ id: judul, judul, mulai, selesai, kategori: 'uts' as const, perkiraan: false, audiens: 'mahasiswa' as const, ...extra });

describe('full morning summary (the phone)', () => {
  it('everything: overdue, today, tomorrow and today\'s events, in Indonesian and English', () => {
    const c = morningCounts(NOW, TZ, [task(1, NOW - 5 * H), task(2, NOW + 3 * H), task(3, NOW + 26 * H), task(4, NOW + 27 * H)], [event('Ujian tengah semester', '2026-11-19', '2026-11-28'), event('Batas KRS', '2026-11-01', '2026-11-19')]);
    expect(c).toEqual({ overdue: 1, today: 1, tomorrow: 2, events: ['Ujian tengah semester', 'Batas KRS'] });
    expect(morningFullView(c!, id)).toMatchObject({ title: 'Ringkasan pagi', message: '1 tugas terlambat, 1 tenggat hari ini, 2 tenggat besok. Hari ini: Ujian tengah semester dan Batas KRS.' });
    expect(morningFullView(c!, en).message).toBe('1 overdue, 1 due today, 2 due tomorrow. Today: Ujian tengah semester and Batas KRS.');
  });
  it('only overdue', () => {
    const c = morningCounts(NOW, TZ, [task(1, NOW - 30 * H), task(2, NOW - H)], []);
    expect(c).toEqual({ overdue: 2, today: 0, tomorrow: 0, events: [] });
    expect(morningFullView(c!, id).message).toBe('2 tugas terlambat.');
  });
  it('only the calendar (estimates and admissions never count; a long period only on its first or last day)', () => {
    const c = morningCounts(NOW, TZ, [task(1, NOW + 5 * 86_400)], [event('Libur', '2026-11-10', '2026-11-30'), event('Perkiraan', '2026-11-19', null, { perkiraan: true }), event('Penerimaan', '2026-11-19', null, { audiens: 'calon_mahasiswa' }), event('Wisuda', '2026-11-19')]);
    expect(c).toEqual({ overdue: 0, today: 0, tomorrow: 0, events: ['Wisuda'] });
    expect(morningFullView(c!, id).message).toBe('Hari ini: Wisuda.');
    expect(morningFullView(c!, en).message).toBe('Today: Wisuda.');
  });
  it('more than two events', () => {
    const c = morningCounts(NOW, TZ, [], ['A', 'B', 'C', 'D'].map((n) => event(n, '2026-11-19')));
    expect(morningFullView(c!, id).message).toBe('Hari ini: A, B, dan 2 lainnya.');
    expect(morningFullView(c!, en).message).toBe('Today: A, B and 2 more.');
  });
  it('nothing at all: not sent, the day still handled', () => {
    expect(morningCounts(NOW, TZ, [task(1, NOW + 5 * 86_400)], [])).toBeNull();
    const plan = planReminders({ now: NOW, timeZone: TZ, tasks: [task(1, NOW + 5 * 86_400)], taskState: {}, activeCourseIds: new Set([1]), settings: { ...DEFAULT_REMINDERS, morning: { enabled: true, atMin: 7 * 60 } }, sent: {}, session: { state: 'OK', expiredAt: null }, morningStyle: 'full' });
    expect(plan.send.filter((n) => n.kind === 'morning')).toEqual([]);
    expect(plan.markSent).toContain('m:2026-11-19');
  });
  it('the planner sends it at the morning time, even with an ended session', () => {
    const plan = planReminders({ now: NOW, timeZone: TZ, tasks: [task(1, NOW - H)], taskState: {}, activeCourseIds: new Set([1]), settings: { ...DEFAULT_REMINDERS, morning: { enabled: true, atMin: 7 * 60 } }, sent: {}, session: { state: 'EXPIRED', expiredAt: NOW - 86_400 }, morningStyle: 'full' });
    const morning = plan.send.find((n) => n.kind === 'morning');
    expect(morning && 'full' in morning ? morning.full : null).toEqual({ overdue: 1, today: 0, tomorrow: 0, events: [] });
  });
  // Tahap 2: the extension sends the same summary (background.ts runNotifyCycle morningStyle 'full').
  it('quiet hours hold it: nothing at the morning time inside the window', () => {
    const plan = planReminders({ now: NOW, timeZone: TZ, tasks: [task(1, NOW - H)], taskState: {}, activeCourseIds: new Set([1]), settings: { ...DEFAULT_REMINDERS, morning: { enabled: true, atMin: 7 * 60 }, quiet: { ...DEFAULT_REMINDERS.quiet, enabled: true, startMin: 22 * 60, endMin: 8 * 60 } }, sent: {}, session: { state: 'OK', expiredAt: null }, morningStyle: 'full' });
    expect(plan.send.filter((n) => n.kind === 'morning')).toEqual([]);
    // ... and it comes at the window's end instead.
    const later = planReminders({ now: NOW + H, timeZone: TZ, tasks: [task(1, NOW - H)], taskState: {}, activeCourseIds: new Set([1]), settings: { ...DEFAULT_REMINDERS, morning: { enabled: true, atMin: 7 * 60 }, quiet: { ...DEFAULT_REMINDERS.quiet, enabled: true, startMin: 22 * 60, endMin: 8 * 60 } }, sent: {}, session: { state: 'OK', expiredAt: null }, morningStyle: 'full' });
    expect(later.send.filter((n) => n.kind === 'morning')).toHaveLength(1);
  });
  it('never a grade or GPA: only counts and calendar event names, both languages', () => {
    for (const m of [id, en]) {
      const view = morningFullView({ overdue: 2, today: 1, tomorrow: 3, events: ['UTS'] }, m);
      expect(`${view.title} ${view.message}`).not.toMatch(/IPK|IPS|GPA|nilai|grade|score|\b[0-4][.,]\d{2}\b/i);
    }
  });
});
