import { describe, expect, it } from 'vitest';
import { ACCOUNT_PENDING_KEY } from '@sulo/core/account/pending';
import type { MoodleClient, PageOutcome, RequestOptions } from '@sulo/core/moodle/client';
import { SESSION_KEY } from '@sulo/core/moodle/session';
import { CURRENT_USER_KEY, userKey } from '@sulo/core/storage';
import { pruneGrades, TASK_GRADES_MAX, taskGradeForCurrent, type TaskGrades } from '@sulo/core/tasks/grade-service';
import type { CourseId, Task } from '@sulo/core/types';
import { memoryStore } from './helpers';

const NOW = Date.UTC(2026, 10, 27, 2, 0) / 1000;
const task: Task = {
  eventId: 7, cmId: 70, courseId: 1 as CourseId, name: 'Laporan praktikum', module: 'assign', dueAt: NOW - 3600, url: 'https://sikola-v2.unhas.ac.id/mod/assign/view.php?id=70',
  overdue: false, firstSeenAt: 0, lastSeenAt: 0, missingSince: null,
};
const quiz: Task = { ...task, eventId: 8, cmId: 80, module: 'quiz' };
const gradedPage = (userid = 5) =>
  `<div class="popover-region" data-userid="${userid}"></div><div id="region-main"><table><tr><th>Grading status</th><td class="submissiongraded cell c1">Graded</td></tr></table>
<div class="box py-3 boxaligncenter feedbacktable"><table class="generaltable"><tbody><tr><th class="cell c0" scope="row">Nilai</th><td class="cell c1 lastcol">85,00 / 100,00</td></tr></tbody></table></div></div>`;

function setup(answer: () => PageOutcome = () => ({ kind: 'ok', html: gradedPage() }), session = 'OK') {
  const store = memoryStore({
    [CURRENT_USER_KEY]: 5,
    [userKey(5, 'tasks')]: [task, quiz],
    [SESSION_KEY]: { state: session, userId: 5, checkedAt: NOW },
  });
  const calls: { path: string; options?: RequestOptions }[] = [];
  const client: MoodleClient = {
    callBatch: async () => ({ kind: 'network_error' }),
    fetchPage: async (path, options) => {
      calls.push({ path, options });
      return answer();
    },
  };
  let now = NOW;
  const deps = { client, store, clock: { now: () => now, localDate: () => '2026-11-27', localHour: () => 10 } };
  return { store, calls, deps, later: (s: number) => void (now += s) };
}

describe('"Lihat nilai": one page, only when asked', () => {
  it('reads the assignment page once, then shows the kept answer for 24 hours', async () => {
    const { calls, deps, store, later } = setup();
    expect(await taskGradeForCurrent(deps, 70, false)).toEqual({ status: 'ok', grade: { kind: 'graded', text: '85,00 / 100,00', got: 85, max: 100 }, fetchedAt: NOW, cached: false });
    expect(calls).toEqual([{ path: '/mod/assign/view.php?id=70', options: { source: 'assign' } }]);
    later(23 * 3600);
    expect(await taskGradeForCurrent(deps, 70, false)).toMatchObject({ status: 'ok', cached: true, fetchedAt: NOW });
    expect(calls).toHaveLength(1);
    expect(store.dump()[userKey(5, 'taskGrades')]).toMatchObject({ '70': { fetchedAt: NOW, requestAt: NOW } });
  });
  it('asks again only after 2 minutes', async () => {
    const { calls, deps, later } = setup();
    await taskGradeForCurrent(deps, 70, false);
    later(60);
    expect(await taskGradeForCurrent(deps, 70, true)).toEqual({ status: 'cooldown', retryAt: NOW + 120 });
    later(61);
    expect(await taskGradeForCurrent(deps, 70, true)).toMatchObject({ status: 'ok', cached: false });
    expect(calls).toHaveLength(2);
  });
  it('only for the student\'s own SIKOLA assignments', async () => {
    const { calls, deps } = setup();
    for (const cmid of [80, 99, 0, -1, 1.5]) expect(await taskGradeForCurrent(deps, cmid, false)).toEqual({ status: 'failed', reason: 'NOT_A_TASK' });
    expect(calls).toHaveLength(0);
  });
  it('never with an ended session', async () => {
    const { calls, deps } = setup(undefined, 'EXPIRED');
    expect(await taskGradeForCurrent(deps, 70, false)).toEqual({ status: 'failed', reason: 'SESSION_EXPIRED' });
    expect(calls).toHaveLength(0);
  });
  it('stores nothing from a page that answers for another account', async () => {
    const { deps, store } = setup(() => ({ kind: 'ok', html: gradedPage(6) }));
    expect(await taskGradeForCurrent(deps, 70, false)).toEqual({ status: 'account_mismatch' });
    expect(store.dump()[ACCOUNT_PENDING_KEY]).toMatchObject({ userId: 6 });
    expect(store.dump()[userKey(5, 'taskGrades')]).toEqual({ '70': { fetchedAt: null, grade: null, requestAt: NOW } });
  });
  it('a refusal or failure is an outcome, and still counts for the wait', async () => {
    const { deps, store } = setup(() => ({ kind: 'refused', reason: 'BUDGET_EXHAUSTED' }));
    expect(await taskGradeForCurrent(deps, 70, false)).toEqual({ status: 'failed', reason: 'BUDGET_EXHAUSTED' });
    expect(await taskGradeForCurrent(deps, 70, false)).toEqual({ status: 'cooldown', retryAt: NOW + 120 });
    expect(store.dump()[userKey(5, 'taskGrades')]).toEqual({ '70': { fetchedAt: null, grade: null, requestAt: NOW } });
  });
  it(`keeps the newest ${TASK_GRADES_MAX} answers`, () => {
    const many: TaskGrades = Object.fromEntries(Array.from({ length: TASK_GRADES_MAX + 5 }, (_, i) => [String(i + 1), { fetchedAt: i, requestAt: i, grade: null }]));
    const kept = pruneGrades(many);
    expect(Object.keys(kept)).toHaveLength(TASK_GRADES_MAX);
    expect(kept['1']).toBeUndefined();
    expect(kept[String(TASK_GRADES_MAX + 5)]).toBeDefined();
  });
});
