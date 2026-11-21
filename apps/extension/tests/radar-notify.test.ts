import { describe, expect, it } from 'vitest';
import { en } from '@sulo/core/i18n/en';
import { id } from '@sulo/core/i18n/id';
import { dueShift } from '@sulo/core/radar/describe';
import { appendChanges } from '@sulo/core/radar/log';
import { DEFAULT_UPDATES } from '@sulo/core/radar/settings';
import { changeKey, planReminders, type PlanInput } from '@sulo/core/reminders/plan';
import { DEFAULT_REMINDERS } from '@sulo/core/reminders/settings';
import { noticeView } from '@sulo/core/reminders/text';
import type { Change, ChangeLogEntry } from '@sulo/core/types';

const TZ = 'Asia/Makassar';
const H = 3600;
const at = (y: number, mo: number, d: number, h: number, mi = 0) => Date.UTC(y, mo - 1, d, h - 8, mi) / 1000; // WITA
const DAYTIME = at(2026, 11, 19, 14, 0);

const added = (courseId: number, cmId: number, name = `Modul ${cmId}`): Change => ({ kind: 'added', courseId, cmId, module: 'resource', name, url: null, since: 1 });
const grade = (courseId: number | null, noteId: number): Change => ({
  kind: 'grade_feedback', courseId,
  notification: { id: noteId, subject: 'Tugas Laporan 3 sudah dinilai: 87', component: 'mod_assign', eventtype: 'assign_notification', timecreated: 1, read: false, contexturl: null },
});
const dueChanged = (from: number, to: number): Change => ({ kind: 'due_changed', courseId: 401, eventId: 9, cmId: 90, name: 'Laporan praktikum', from, to, url: 'https://x' });

const input = (changes: ChangeLogEntry[], now: number, patch: Partial<PlanInput> = {}): PlanInput => ({
  now, timeZone: TZ, tasks: [], taskState: {}, activeCourseIds: new Set(), settings: DEFAULT_REMINDERS, sent: {},
  session: { state: 'OK', expiredAt: null }, changes, updates: DEFAULT_UPDATES, ...patch,
});

describe('update notifications', () => {
  it('groups one cycle per course', () => {
    const log = appendChanges([], [added(401, 1), added(401, 2), grade(402, 7)], DAYTIME);
    const plan = planReminders(input(log, DAYTIME));
    expect(plan.send.map((n) => n.kind === 'changes' && [n.courseId, n.entries.length])).toEqual([[401, 2], [402, 1]]);
    expect(plan.markSent).toEqual(expect.arrayContaining(log.map(changeKey)));
  });

  it('sends one summary when more than 3 courses changed', () => {
    const log = appendChanges([], [added(401, 1), added(402, 2), added(403, 3), added(404, 4)], DAYTIME);
    expect(planReminders(input(log, DAYTIME)).send).toEqual([{ kind: 'changes_summary', key: `chs:${DAYTIME}`, count: 4, courses: 4 }]);
  });

  it('holds everything during quiet hours, then sends one summary', () => {
    const night = at(2026, 11, 19, 23, 0);
    const log = appendChanges([], [added(401, 1)], night);
    const held = planReminders(input(log, night));
    expect(held.send).toEqual([]);
    expect(held.nextAt).toBe(at(2026, 11, 20, 6, 0));
    const morning = planReminders(input(log, at(2026, 11, 20, 6, 0)));
    expect(morning.send.map((n) => n.kind)).toEqual(['changes_summary']);
  });

  it('never sends an update twice', () => {
    const log = appendChanges([], [added(401, 1)], DAYTIME);
    const first = planReminders(input(log, DAYTIME));
    const sent = Object.fromEntries(first.markSent.map((k) => [k, DAYTIME]));
    expect(planReminders(input(log, DAYTIME + 60, { sent })).send).toEqual([]);
  });

  it('skips turned-off kinds and does not replay them when turned on later', () => {
    const log = appendChanges([], [grade(402, 7)], DAYTIME);
    const off = planReminders(input(log, DAYTIME, { updates: { ...DEFAULT_UPDATES, grades: false } }));
    expect(off.send).toEqual([]);
    const sent = Object.fromEntries(off.markSent.map((k) => [k, DAYTIME]));
    expect(planReminders(input(log, DAYTIME + 60, { sent })).send).toEqual([]);
  });

  it('logs but never notifies removals, renames and other notifications', () => {
    const log = appendChanges([], [{ kind: 'removed', courseId: 401, cmId: 1, module: 'page', name: 'x', since: 1 }], DAYTIME);
    expect(planReminders(input(log, DAYTIME)).send).toEqual([]);
  });
});

describe('update notification text', () => {
  const ctx = (m = id) => ({ now: DAYTIME, timeZone: TZ, m, courseName: () => '', courseNameById: (c: number | null) => (c === 401 ? 'Hidrologi' : c === 402 ? 'Analisa Struktur I' : null) });
  const notice = (changes: Change[], courseId: number | null) => ({ kind: 'changes' as const, key: 'k', courseId, entries: appendChanges([], changes, DAYTIME) });

  it('several changes in one course: one summary, "3 hal baru di …"', () => {
    const v = noticeView(notice([added(401, 1, 'Modul 5'), added(401, 2, 'Video 6'), added(401, 3, 'Kuis latihan')], 401), ctx());
    expect([v.title, v.message, v.icon]).toEqual(['3 hal baru di Hidrologi', 'Modul 5, Video 6, dan 1 lainnya.', 'idle']);
  });

  it('one new material keeps its own title', () => {
    const v = noticeView(notice([added(401, 1, 'Modul 5')], 401), ctx());
    expect(v.title).toBe('Materi baru di Hidrologi');
  });

  it('says how far a due date moved, with the urgent mascot when earlier', () => {
    const from = at(2026, 11, 20, 23, 59);
    const later = noticeView(notice([dueChanged(from, from + 2 * 86_400)], 401), ctx());
    expect(later.title).toBe('Tenggat Laporan praktikum diundur 2 hari');
    expect(later.message).toBe('Hidrologi. Tenggat baru Minggu 23.59.');
    expect(later.icon).toBe('idle');
    const earlier = noticeView(notice([dueChanged(from, from - 86_400)], 401), ctx());
    expect([earlier.title, earlier.icon]).toEqual(['Tenggat Laporan praktikum dimajukan 1 hari', 'urgent']);
    expect(noticeView(notice([dueChanged(from, from + 2 * 86_400)], 401), ctx(en)).title).toBe('Laporan praktikum: due date moved 2 days later');
  });

  it('never shows the grade, the subject or a comment for grades and feedback', () => {
    const v = noticeView(notice([grade(402, 7)], 402), ctx());
    expect([v.title, v.message, v.icon]).toEqual(['Ada nilai atau feedback baru di Analisa Struktur I', 'Buka untuk melihatnya di SIKOLA.', 'happy']);
    expect(JSON.stringify(v)).not.toMatch(/87|dinilai/);
  });

  it('mixes kinds with a count per kind', () => {
    const v = noticeView(notice([added(401, 1), dueChanged(at(2026, 11, 20, 23, 59), at(2026, 11, 21, 23, 59))], 401), ctx());
    expect([v.title, v.message]).toEqual(['2 hal baru di Hidrologi', '1 materi baru, 1 tenggat berubah.']);
  });

  it('describes shifts in hours under half a day', () => {
    expect(dueShift(DAYTIME, DAYTIME + 5 * H, TZ, id)).toBe('diundur 5 jam');
    expect(dueShift(null, DAYTIME, TZ, id)).toBe('ditambahkan');
  });
});
