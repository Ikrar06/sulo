import { describe, expect, it } from 'vitest';
import { countdownOf, formatDateKey, formatRange } from '../lib/calendar/countdown';
import { currentWeek } from '../lib/calendar/current-week';
import { bundledCalendar } from '../lib/calendar/remote';
import { setActivePin, setAlias, setColor } from '../lib/courses/edit';
import { levelOf, loadMap } from '../lib/dashboard/load-map';
import { dashboardPath, parseRoute, routeHash } from '../lib/dashboard/routes';
import { buildTaskItems, countByStatus, filterTasks, DEFAULT_TASK_FILTER } from '../lib/dashboard/tasks';
import { dashEn } from '../lib/i18n/dashboard/en';
import { dashId } from '../lib/i18n/dashboard/id';
import { DEFAULT_PREFS, PREFS_KEY, readPrefs } from '../lib/prefs';
import { addStep, getTaskState, NOTE_MAX, removeStep, setCustomDue, setNote, STEPS_MAX, toggleStep } from '../lib/tasks/local-state';
import { applyPersonalDue } from '../lib/tasks/personal-due';
import { applyTheme } from '../lib/ui/theme';
import type { CourseRecord, Task } from '../lib/types';
import { memoryStore } from './helpers';

const NOW = Date.UTC(2026, 10, 16, 2, 0) / 1000; // Mon 16 Nov 2026, 10.00 WITA
const TZ = 'Asia/Makassar';
const H = 3600;

const course = (id: number, name: string, activePin: boolean | null = true): CourseRecord => ({
  id,
  fullname: name,
  shortname: name,
  startdate: 0,
  enddate: 0,
  parsed: { name, classLetter: null, program: null, code: null } as unknown as CourseRecord['parsed'],
  inProgress: true,
  past: false,
  activeScore: 5,
  activeReasons: [],
  activePin,
  alias: null,
  color: null,
});
const task = (eventId: number, courseId: number, dueAt: number | null, extra: Partial<Task> = {}): Task => ({
  eventId,
  cmId: null,
  courseId,
  name: `Tugas ${eventId}`,
  module: 'assign',
  dueAt,
  url: `https://sikola-v2.unhas.ac.id/mod/assign/view.php?id=${eventId}`,
  overdue: false,
  firstSeenAt: NOW,
  lastSeenAt: NOW,
  missingSince: null,
  ...extra,
});

describe('dashboard routes', () => {
  it('opens a page from the hash, with an optional detail', () => {
    expect(parseRoute('#kalender')).toEqual({ page: 'kalender', detail: null });
    expect(parseRoute('#tugas/1234')).toEqual({ page: 'tugas', detail: '1234' });
    expect(parseRoute('#pengaturan/kalender')).toEqual({ page: 'pengaturan', detail: 'kalender' });
    expect(parseRoute('')).toEqual({ page: 'ringkasan', detail: null });
    expect(parseRoute('#tidak-ada/9')).toEqual({ page: 'ringkasan', detail: null });
  });
  it('builds links for the popup and notifications', () => {
    expect(routeHash('tugas', 12)).toBe('#tugas/12');
    expect(dashboardPath('kalender')).toBe('/dashboard.html#kalender');
  });
});

describe('task list', () => {
  const user = {
    courses: [course(1, 'Hidrologi'), course(2, 'Statistika', false)],
    tasks: [task(10, 1, NOW + 5 * H), task(11, 1, null), task(12, 2, NOW + H), task(13, 1, NOW - H, { missingSince: NOW }), task(14, 1, NOW + 2 * H, { name: 'Laporan praktikum' })],
    taskState: { '14': { eventId: 14, doneManually: true, snoozedUntil: null, steps: [], note: 'kumpul di kelas' } },
  };
  const items = buildTaskItems(user);

  it('gives each task a status', () => {
    expect(Object.fromEntries(items.map((i) => [i.task.eventId, i.status]))).toEqual({ 10: 'pending', 11: 'pending', 12: 'inactive', 13: 'submitted', 14: 'done' });
    expect(countByStatus(items)).toEqual({ pending: 2, done: 1, submitted: 1, inactive: 1 });
  });

  it('filters by status, course and search (name, course or note), dated first', () => {
    expect(filterTasks(items, DEFAULT_TASK_FILTER).map((i) => i.task.eventId)).toEqual([10, 11]);
    expect(filterTasks(items, { ...DEFAULT_TASK_FILTER, status: 'all', courseId: 2 }).map((i) => i.task.eventId)).toEqual([12]);
    expect(filterTasks(items, { ...DEFAULT_TASK_FILTER, status: 'all', query: 'KELAS' }).map((i) => i.task.eventId)).toEqual([14]);
    // By course name, sorted by due time, undated last.
    expect(filterTasks(items, { ...DEFAULT_TASK_FILTER, status: 'all', query: 'hidro' }).map((i) => i.task.eventId)).toEqual([13, 14, 10, 11]);
  });

  it('a personal due date stands in for a missing one, never for a real one', () => {
    const state = { '11': { ...getTaskState({}, 11), customDueAt: NOW + 3 * H }, '10': { ...getTaskState({}, 10), customDueAt: NOW + 99 * H } };
    const { tasks, personal } = applyPersonalDue(user.tasks, state);
    expect(tasks.find((t) => t.eventId === 11)?.dueAt).toBe(NOW + 3 * H);
    expect(tasks.find((t) => t.eventId === 10)?.dueAt).toBe(NOW + 5 * H);
    expect([...personal]).toEqual([11]);
    expect(user.tasks.find((t) => t.eventId === 11)?.dueAt).toBeNull(); // input untouched
  });
});

describe('local task state (steps, note, personal due)', () => {
  it('adds, toggles and removes steps without touching the input', () => {
    const empty = {};
    const one = addStep(empty, 7, '  kumpulkan data  ', 's1');
    expect(getTaskState(one, 7).steps).toEqual([{ id: 's1', text: 'kumpulkan data', done: false }]);
    expect(empty).toEqual({});
    expect(addStep(one, 7, '   ', 's2')).toBe(one);
    const toggled = toggleStep(one, 7, 's1');
    expect(getTaskState(toggled, 7).steps[0]?.done).toBe(true);
    expect(getTaskState(removeStep(toggled, 7, 's1'), 7).steps).toEqual([]);
  });
  it('caps steps and note length', () => {
    let map = {};
    for (let i = 0; i < STEPS_MAX + 5; i++) map = addStep(map, 1, `langkah ${i}`, `s${i}`);
    expect(getTaskState(map, 1).steps).toHaveLength(STEPS_MAX);
    expect(getTaskState(setNote({}, 1, 'x'.repeat(NOTE_MAX + 50)), 1).note).toHaveLength(NOTE_MAX);
  });
  it('sets and clears a personal due date', () => {
    expect(getTaskState(setCustomDue({}, 3, NOW), 3).customDueAt).toBe(NOW);
    expect(getTaskState(setCustomDue(setCustomDue({}, 3, NOW), 3, null), 3).customDueAt).toBeNull();
  });
});

describe('course edits', () => {
  const list = [course(1, 'Hidrologi'), course(2, 'Statistika')];
  it('display name: trimmed, blank restores the SIKOLA name', () => {
    expect(setAlias(list, 1, '  Hidro   Terapan ')[0]?.alias).toBe('Hidro Terapan');
    expect(setAlias(setAlias(list, 1, 'X'), 1, '   ')[0]?.alias).toBeNull();
    expect(list[0]?.alias).toBeNull();
  });
  it('color: 1..8 or automatic; anything else is ignored', () => {
    expect(setColor(list, 2, 3)[1]?.color).toBe('course-3');
    expect(setColor(list, 2, null)[1]?.color).toBeNull();
    expect(setColor(list, 2, 9)[1]?.color).toBeNull();
    expect(setActivePin(list, 1, false)[0]?.activePin).toBe(false);
  });
});

describe('load map', () => {
  const cal = bundledCalendar();
  it('levels: more tasks are darker; an exam day is at least 3', () => {
    expect([0, 1, 2, 3, 4, 6].map((n) => levelOf(n, false))).toEqual([0, 1, 2, 2, 3, 4]);
    expect(levelOf(0, true)).toBe(3);
  });
  it('14 local days with tasks and calendar events (UAS from 30 Nov)', () => {
    const days = loadMap([task(1, 1, NOW + 3 * H), task(2, 1, NOW + 26 * H)], cal.kegiatan, NOW, TZ);
    expect(days).toHaveLength(14);
    expect(days[0]).toMatchObject({ dateKey: '2026-11-16', level: 1 });
    expect(days[1]?.tasks).toHaveLength(1);
    expect(days[13]?.dateKey).toBe('2026-11-29');
    const uas = loadMap([], cal.kegiatan, NOW + 14 * 86_400, TZ)[0]!;
    expect(uas.events.map((e) => e.kategori)).toContain('uas');
    expect(uas.level).toBe(3);
  });
  it('leaves out estimates and admissions', () => {
    const days = loadMap([], cal.kegiatan, NOW, TZ);
    expect(days.flatMap((d) => d.events).some((e) => e.kategori === 'penerimaan' || e.kategori === 'kkn')).toBe(false);
  });
});

describe('calendar on the dashboard', () => {
  const cal = bundledCalendar();
  it('countdown text kinds', () => {
    expect(countdownOf({ mulai: '2026-11-30', selesai: '2026-12-05' }, '2026-11-16')).toEqual({ kind: 'days', n: 14 });
    expect(countdownOf({ mulai: '2026-11-17', selesai: '2026-11-17' }, '2026-11-16')).toEqual({ kind: 'tomorrow' });
    expect(countdownOf({ mulai: '2027-01-03', selesai: '2027-02-12' }, '2027-01-10')).toEqual({ kind: 'ongoing', until: '2027-02-12' });
    expect(countdownOf({ mulai: '2027-02-01', selesai: '2027-02-12' }, '2027-02-12')).toEqual({ kind: 'today' });
    expect(countdownOf({ mulai: '2027-06-28', selesai: null }, '2027-07-01')).toEqual({ kind: 'ongoingOpen' });
  });
  it('formats calendar dates without shifting them', () => {
    expect(formatDateKey('2026-08-17', 'id-ID')).toBe('17 Agu 2026');
    expect(formatRange({ mulai: '2026-11-30', selesai: '2026-12-05' }, 'id-ID', 'sampai', 'terbuka')).toBe('30 Nov sampai 5 Des 2026');
    expect(formatRange({ mulai: '2027-06-28', selesai: null }, 'en-GB', 'to', 'no end date')).toBe('28 Jun 2027 (no end date)');
  });
  it('the current week picks the running semester, or says it is not available', () => {
    expect(currentWeek(cal, '2026-11-16')).toMatchObject({ semester: 'awal', info: { kind: 'week', nomor: 14 } });
    expect(currentWeek(cal, '2026-08-10')).toMatchObject({ semester: 'awal', info: { kind: 'before' } });
    expect(currentWeek(cal, '2027-03-01')).toEqual({ semester: 'akhir', info: { kind: 'unavailable' } });
    expect(currentWeek(cal, '2027-07-15')).toEqual({ semester: null, info: { kind: 'after' } });
  });
});

describe('preferences added in M5a', () => {
  it('defaults: system theme, no nickname or intake year, calendar notifications on', () => {
    expect(DEFAULT_PREFS).toMatchObject({ theme: 'system', nickname: '', angkatan: null });
    expect(Object.values(DEFAULT_PREFS.calendar).every(Boolean)).toBe(true);
  });
  it('older stored preferences gain the new fields; bad values fall back', async () => {
    expect(await readPrefs(memoryStore({ [PREFS_KEY]: { locale: 'en', dueFormat: 'clock' } }))).toMatchObject({ locale: 'en', dueFormat: 'clock', theme: 'system' });
    expect(await readPrefs(memoryStore({ [PREFS_KEY]: { theme: 'neon', angkatan: 1800, nickname: 'x'.repeat(99), calendar: { krs: false } } }))).toMatchObject({
      theme: 'system',
      angkatan: null,
      nickname: 'x'.repeat(24),
      calendar: { krs: false, uas: true },
    });
  });
  it('theme: "system" removes the attribute, the others set it', () => {
    const attrs = new Map<string, string>();
    const root = { setAttribute: (n: string, v: string) => void attrs.set(n, v), removeAttribute: (n: string) => void attrs.delete(n) };
    applyTheme(root, 'dark');
    expect(attrs.get('data-theme')).toBe('dark');
    applyTheme(root, 'system');
    expect(attrs.has('data-theme')).toBe(false);
  });
});

describe('dashboard dictionaries', () => {
  const keys = (o: object, prefix = ''): string[] =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
  it('English has every Indonesian key', () => {
    expect(keys(dashEn).sort()).toEqual(keys(dashId).sort());
  });
});
