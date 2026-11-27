import { describe, expect, it } from 'vitest';
import { ACCOUNT_PENDING_KEY } from '@sulo/core/account/pending';
import type { MoodleClient, PageOutcome, RequestOptions } from '@sulo/core/moodle/client';
import { SESSION_KEY } from '@sulo/core/moodle/session';
import { CURRENT_USER_KEY, userKey } from '@sulo/core/storage';
import { courseGradesForCurrent, pruneGrades, TASK_GRADES_MAX, taskGradeForCurrent, type TaskGrades } from '@sulo/core/tasks/grade-service';
import { getTaskState } from '@sulo/core/tasks/local-state';
import type { CourseId, Task } from '@sulo/core/types';
import { memoryStore } from './helpers';

const NOW = Date.UTC(2026, 10, 27, 2, 0) / 1000;
const H = 3600;
const assign = (eventId: number, cmId: number, extra: Partial<Task> = {}): Task => ({
  eventId, cmId, courseId: 1 as CourseId, name: `Tugas ${eventId}`, module: 'assign', dueAt: NOW - H, url: `https://sikola-v2.unhas.ac.id/mod/assign/view.php?id=${cmId}`,
  overdue: false, firstSeenAt: 0, lastSeenAt: 0, missingSince: null, ...extra,
});
// Course 1: two past assignments and one not due yet; a quiz; course 2 has only a future one.
const tasks: Task[] = [assign(7, 70), assign(8, 71), assign(9, 72, { dueAt: NOW + H }), { ...assign(10, 80), module: 'quiz' }, assign(11, 90, { courseId: 2 as CourseId, dueAt: NOW + H })];

const navbar = (userid: number) => `<div class="popover-region" data-userid="${userid}"></div>`;
const report = (rows: string, userid = 5) =>
  `${navbar(userid)}<div id="region-main"><table class="generaltable boxaligncenter user-grade"><tbody>${rows}</tbody></table></div>`;
const row = (cmid: number, grade: string) =>
  `<tr><th class="level2 column-itemname"><a class="gradeitemheader" href="https://sikola-v2.unhas.ac.id/mod/assign/view.php?id=${cmid}">Tugas</a></th><td class="level2 column-grade">${grade}</td><td class="level2 column-feedback">Bagus, Pak Dosen</td></tr>`;
const assignPage = (grade: string) => `${navbar(5)}<div id="region-main"><div class="box feedbacktable"><table class="generaltable"><tr><th>Grade</th><td>${grade}</td></tr></table></div></div>`;

function setup(answer: (path: string) => PageOutcome, session = 'OK') {
  const store = memoryStore({
    [CURRENT_USER_KEY]: 5,
    [userKey(5, 'tasks')]: tasks,
    [userKey(5, 'courses')]: [{ id: 1 }, { id: 2 }, { id: 4 }],
    [SESSION_KEY]: { state: session, userId: 5, checkedAt: NOW },
  });
  const calls: { path: string; options?: RequestOptions }[] = [];
  const client: MoodleClient = {
    callBatch: async () => ({ kind: 'network_error' }),
    fetchPage: async (path, options) => {
      calls.push({ path, options });
      return answer(path);
    },
  };
  let now = NOW;
  const deps = { client, store, clock: { now: () => now, localDate: () => '2026-11-27', localHour: () => 10 } };
  const done = async (eventId: number) => getTaskState((await store.get(userKey(5, 'taskState'))) ?? {}, eventId).doneManually;
  return { store, calls, deps, done, later: (s: number) => void (now += s) };
}

const graded = (): PageOutcome => ({ kind: 'ok', html: report(row(70, '90,00 (A)') + row(71, '-')) });

describe('"Lihat nilai": one page per course', () => {
  it('a task\'s "Lihat nilai" reads its course\'s report once, for every assignment of that course', async () => {
    const { calls, deps, store, done } = setup(graded);
    expect(await taskGradeForCurrent(deps, 70, false)).toEqual({ status: 'ok', grade: { kind: 'graded', text: '90,00 (A)', got: 90, max: null, letter: 'A' }, fetchedAt: NOW, cached: false, markedDone: true });
    expect(calls).toEqual([{ path: '/grade/report/user/index.php?id=1', options: { source: 'assign' } }]);
    // The other assignment came with the same page: no request for it.
    expect(await taskGradeForCurrent(deps, 71, false)).toMatchObject({ status: 'ok', grade: { kind: 'not_graded' }, cached: true });
    expect(calls).toHaveLength(1);
    // The graded one is finished: marked done; the other is not.
    expect(await done(7)).toBe(true);
    expect(await done(8)).toBe(false);
    // Nothing of the feedback column is kept.
    expect(JSON.stringify(store.dump())).not.toMatch(/Bagus|Dosen/);
  });
  it('the course heading reads the same page; again within 2 minutes waits, within a day shows what it has', async () => {
    const { calls, deps, later } = setup(graded);
    expect(await courseGradesForCurrent(deps, 1, false)).toEqual({ status: 'ok', fetchedAt: NOW, cached: false, graded: 1, markedDone: [70] });
    later(60);
    expect(await courseGradesForCurrent(deps, 1, true)).toEqual({ status: 'cooldown', retryAt: NOW + 120 });
    expect(await courseGradesForCurrent(deps, 1, false)).toMatchObject({ status: 'ok', cached: true, graded: 1, markedDone: [] });
    expect(calls).toHaveLength(1);
  });
  it('never marks again a task the student unmarked after its grade was read', async () => {
    const { deps, store, done, later } = setup(graded);
    await courseGradesForCurrent(deps, 1, false);
    await store.set(userKey(5, 'taskState'), {});
    later(3 * 60);
    expect(await courseGradesForCurrent(deps, 1, true)).toMatchObject({ status: 'ok', markedDone: [] });
    expect(await done(7)).toBe(false);
  });
  it('brings in every assignment Sulo never saw in the calendar: graded ones done, the rest probably handed in', async () => {
    // Course 4: no task known (handed in before Sulo looked, or nothing to submit online).
    const { deps, store, done } = setup(() => ({ kind: 'ok', html: report(row(401, '90.00 (A)') + row(402, '-')) }));
    expect(await courseGradesForCurrent(deps, 4, false)).toMatchObject({ status: 'ok', graded: 1, markedDone: [401] });
    const added = ((await store.get(userKey(5, 'tasks'))) as Task[]).filter((t) => t.fromReport);
    const reported = (cmid: number) => ({ eventId: -cmid, cmId: cmid, courseId: 4, name: 'Tugas', module: 'assign', dueAt: null, url: `https://sikola-v2.unhas.ac.id/mod/assign/view.php?id=${cmid}`, overdue: false, firstSeenAt: NOW, lastSeenAt: NOW, missingSince: NOW, fromReport: true });
    expect(added).toEqual([reported(401), reported(402)]);
    expect(await done(-401)).toBe(true);
    // Not graded yet: in the history as probably handed in, not marked done.
    expect(await done(-402)).toBe(false);
    // Its detail reads the kept answer.
    expect(await taskGradeForCurrent(deps, 401, false)).toMatchObject({ status: 'ok', grade: { got: 90, letter: 'A' }, cached: true });
  });
  it('only one of the student\'s own courses', async () => {
    const { calls, deps } = setup(graded);
    for (const id of [3, 0, -1]) expect(await courseGradesForCurrent(deps, id, false)).toEqual({ status: 'failed', reason: 'NOT_A_COURSE' });
    // A quiz, a task not due yet, no task.
    for (const cmid of [80, 72, 99, 0, 1.5]) expect(await taskGradeForCurrent(deps, cmid, false)).toEqual({ status: 'failed', reason: 'NOT_A_TASK' });
    expect(calls).toHaveLength(0);
  });
  it('a report Sulo cannot read: said once, then the task reads its own page on the next tap', async () => {
    const { calls, deps, later } = setup((path) => (path.startsWith('/grade/') ? { kind: 'ok', html: `${navbar(5)}<p>Laporan dimatikan</p>` } : { kind: 'ok', html: assignPage('88,00') }));
    expect(await taskGradeForCurrent(deps, 70, false)).toEqual({ status: 'failed', reason: 'REPORT_UNREADABLE' });
    later(10);
    expect(await taskGradeForCurrent(deps, 70, true)).toMatchObject({ status: 'ok', grade: { kind: 'graded', got: 88 }, markedDone: true });
    expect(calls.map((c) => c.path)).toEqual(['/grade/report/user/index.php?id=1', '/mod/assign/view.php?id=70']);
    expect(await courseGradesForCurrent(deps, 1, true)).toEqual({ status: 'failed', reason: 'REPORT_UNREADABLE' });
  });
  it('stores nothing from a page that answers for another account', async () => {
    const { deps, store } = setup(() => ({ kind: 'ok', html: report(row(70, '90,00'), 6) }));
    expect(await courseGradesForCurrent(deps, 1, false)).toEqual({ status: 'account_mismatch' });
    expect(store.dump()[ACCOUNT_PENDING_KEY]).toMatchObject({ userId: 6 });
    expect(store.dump()[userKey(5, 'taskGrades')]).toBeUndefined();
  });
  it('never with an ended session; a refusal is an outcome that still counts for the wait', async () => {
    const ended = setup(graded, 'EXPIRED');
    expect(await courseGradesForCurrent(ended.deps, 1, false)).toEqual({ status: 'failed', reason: 'SESSION_EXPIRED' });
    expect(ended.calls).toHaveLength(0);
    const refused = setup(() => ({ kind: 'refused', reason: 'BUDGET_EXHAUSTED' }));
    expect(await courseGradesForCurrent(refused.deps, 1, false)).toEqual({ status: 'failed', reason: 'BUDGET_EXHAUSTED' });
    expect(await courseGradesForCurrent(refused.deps, 1, false)).toEqual({ status: 'cooldown', retryAt: NOW + 120 });
  });
  it(`keeps the newest ${TASK_GRADES_MAX} answers, only for tasks still kept`, () => {
    const many: TaskGrades = Object.fromEntries(Array.from({ length: TASK_GRADES_MAX + 5 }, (_, i) => [String(i + 1), { fetchedAt: i, requestAt: i, grade: null }]));
    const kept = pruneGrades(many);
    expect(Object.keys(kept)).toHaveLength(TASK_GRADES_MAX);
    expect(kept['1']).toBeUndefined();
    expect(Object.keys(pruneGrades(many, new Set([3, 4])))).toEqual(['3', '4']);
  });
});
