import { describe, expect, it } from 'vitest';
import { buildTaskItems } from '@sulo/core/dashboard/tasks';
import { runNotifyCycle, type Notifier } from '@sulo/core/reminders/run';
import { SESSION_KEY } from '@sulo/core/moodle/session';
import { CURRENT_USER_KEY, readAllUser, readUser, userKey } from '@sulo/core/storage';
import { addOwnTask, cleanTitle, followsTask, isOwnTask, nextOwnId, NO_COURSE, OWN_MODULE, OWN_TITLE_MAX, removeOwnTask, updateOwnTask, withOwnTasks, type OwnTask } from '@sulo/core/tasks/own';
import type { CourseId, CourseRecord, Task } from '@sulo/core/types';
import { memoryStore } from './helpers';

const H = 3600;
const NOW = Date.UTC(2026, 10, 19, 4, 0) / 1000; // Thu 19 Nov 2026, 12.00 WITA
const course: CourseRecord = {
  id: 1, fullname: 'FISIKA DASAR', shortname: 'FD', startdate: NOW - 90 * 86_400, enddate: NOW + 90 * 86_400,
  parsed: { name: 'Fisika Dasar', classLetter: 'B', program: null, code: null, matched: true },
  inProgress: true, past: false, activeScore: 8, activeReasons: ['inprogress'], activePin: null, alias: null, color: null,
};
const sikolaTask: Task = {
  eventId: 7, cmId: 70, courseId: 1 as CourseId, name: 'Laporan praktikum', module: 'assign', dueAt: NOW + 30 * H, url: 'https://sikola-v2.unhas.ac.id/mod/assign/view.php?id=70',
  overdue: false, firstSeenAt: 0, lastSeenAt: 0, missingSince: null,
};

describe('own tasks: the list', () => {
  it('adds with a clean title, never with an empty one', () => {
    const list = addOwnTask([], { title: '  Presentasi   kelompok ', courseId: null, dueAt: NOW + H }, NOW);
    expect(list).toEqual([{ id: -NOW * 100, title: 'Presentasi kelompok', courseId: null, dueAt: NOW + H, createdAt: NOW }]);
    expect(addOwnTask(list, { title: '   ', courseId: null, dueAt: null }, NOW)).toEqual(list);
    expect(cleanTitle('x'.repeat(OWN_TITLE_MAX + 20))).toHaveLength(OWN_TITLE_MAX);
  });
  it('gives negative ids that are never reused, even in the same second or after a delete', () => {
    const a = addOwnTask([], { title: 'A', courseId: null, dueAt: null }, NOW);
    const b = addOwnTask(a, { title: 'B', courseId: null, dueAt: null }, NOW);
    expect(b[1]!.id).toBeLessThan(b[0]!.id);
    const removed = removeOwnTask(b, b[1]!.id);
    const c = addOwnTask(removed, { title: 'C', courseId: null, dueAt: null }, NOW + 5);
    expect(c.map((o) => o.id).every((id) => id < 0)).toBe(true);
    expect(new Set([...b.map((o) => o.id), c[1]!.id]).size).toBe(3);
    expect(nextOwnId([], NOW)).toBeLessThan(-1_000_000_000);
  });
  it('changes and removes without touching the others, and never in place', () => {
    const list = addOwnTask(addOwnTask([], { title: 'A', courseId: null, dueAt: null }, NOW), { title: 'B', courseId: null, dueAt: null }, NOW + 1);
    const frozen = structuredClone(list);
    const changed = updateOwnTask(list, list[0]!.id, { title: 'A2', courseId: 1 as CourseId, dueAt: NOW + 2 * H });
    expect(changed[0]).toMatchObject({ title: 'A2', courseId: 1, dueAt: NOW + 2 * H });
    expect(changed[1]).toEqual(list[1]);
    expect(updateOwnTask(list, list[0]!.id, { title: ' ', courseId: null, dueAt: null })[0]!.title).toBe('A');
    expect(removeOwnTask(list, list[0]!.id)).toEqual([list[1]]);
    expect(list).toEqual(frozen);
  });
  it('joins SIKOLA tasks as module "own" tasks, counted whatever course is followed', () => {
    const own: OwnTask = { id: -5, title: 'Proyek', courseId: null, dueAt: NOW + H, createdAt: NOW };
    const joined = withOwnTasks([sikolaTask], [own]);
    expect(joined).toHaveLength(2);
    expect(joined[1]).toMatchObject({ eventId: -5, module: OWN_MODULE, courseId: NO_COURSE, name: 'Proyek', url: '', missingSince: null });
    expect(isOwnTask(joined[1]!)).toBe(true);
    expect(followsTask(new Set(), joined[1]!)).toBe(true);
    expect(followsTask(new Set(), sikolaTask)).toBe(false);
  });
});

describe('own tasks: where they show', () => {
  const own: OwnTask = { id: -9, title: 'Presentasi', courseId: null, dueAt: NOW + 3 * H, createdAt: NOW - H };
  const store = () =>
    memoryStore({
      [CURRENT_USER_KEY]: 5,
      // SIKOLA's task far off, so the added one's reminder is the only one due.
      [userKey(5, 'tasks')]: [{ ...sikolaTask, dueAt: NOW + 10 * 24 * H }],
      [userKey(5, 'courses')]: [course],
      [userKey(5, 'ownTasks')]: [own],
      [SESSION_KEY]: { state: 'OK', userId: 5, checkedAt: NOW },
    });

  it('views get them, sync and Radar never do', async () => {
    const s = store();
    expect((await readAllUser(s, 5)).tasks.map((t) => t.eventId)).toEqual([7, -9]);
    expect((await readUser(s, 5, 'tasks')).map((t) => t.eventId)).toEqual([7]);
  });
  it('are pending with the caller\'s label, not "inactive" without a course', async () => {
    const items = buildTaskItems(await readAllUser(store(), 5), 'Tugas sendiri');
    const item = items.find((i) => i.task.eventId === -9)!;
    expect(item.status).toBe('pending');
    expect(item.courseName).toBe('Tugas sendiri');
  });
  it('get the same reminders, named as the student\'s own task', async () => {
    const shown: { id: string; title: string; message: string }[] = [];
    const notifier: Notifier = { show: async (id, view) => void shown.push({ id, title: view.title, message: view.message }) };
    await runNotifyCycle({ store: store(), now: NOW, timeZone: 'Asia/Makassar', uiLanguage: 'id', notifier });
    expect(shown).toEqual([{ id: `task|-9|t:-9:180:${NOW + 3 * H}`, title: 'Presentasi, 3 jam lagi', message: 'Tugas sendiri. Tenggat hari ini 15.00.' }]);
  });
});
