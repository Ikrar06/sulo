import { describe, expect, it } from 'vitest';
import { BUDGET_KEY } from '@sulo/core/moodle/budget';
import type { MoodleClient } from '@sulo/core/moodle/client';
import { SESSION_KEY } from '@sulo/core/moodle/session';
import { CURRENT_USER_KEY, userKey } from '@sulo/core/storage';
import { COURSE_SWEEP_FRESH_SEC, gradeSweep, reportDue, SWEEP_GAP_SEC, SWEEP_MAX_OPEN } from '@sulo/core/tasks/grade-sweep';
import type { CourseId, CourseRecord } from '@sulo/core/types';
import { memoryStore } from './helpers';

const NOW = Date.UTC(2026, 10, 27, 4, 0) / 1000;
const course = (id: number, active = true): CourseRecord => ({
  id: id as CourseId, fullname: `C${id}`, shortname: `C${id}`, startdate: NOW - 90 * 86_400, enddate: NOW + 90 * 86_400,
  parsed: { name: `C${id}`, classLetter: null, program: null, code: null, matched: true },
  inProgress: active, past: false, activeScore: active ? 8 : 0, activeReasons: active ? ['inprogress'] : [], activePin: active ? null : false, alias: null, color: null,
});
const report = (cmid: number) =>
  `<div class="popover-region" data-userid="5"></div><table class="user-grade"><tr><th class="column-itemname"><a href="/mod/assign/view.php?id=${cmid}">T</a></th><td class="column-grade">80,00</td></tr></table>`;

function setup(courses: CourseRecord[], extra: Record<string, unknown> = {}) {
  const store = memoryStore({ [CURRENT_USER_KEY]: 5, [userKey(5, 'courses')]: courses, [userKey(5, 'tasks')]: [], [SESSION_KEY]: { state: 'OK', userId: 5, checkedAt: NOW }, ...extra });
  const paths: string[] = [];
  const client: MoodleClient = {
    callBatch: async () => ({ kind: 'network_error' }),
    fetchPage: async (path) => {
      paths.push(path);
      return { kind: 'ok', html: report(Number(path.split('=')[1]) * 10) };
    },
  };
  let now = NOW;
  const deps = { client, store, clock: { now: () => now, localDate: () => '2026-11-27', localHour: () => 12 } };
  return { store, paths, deps, later: (s: number) => void (now += s) };
}

describe('grades without a tap: opening Tugas, and each sync', () => {
  it('opening Tugas reads every followed course, then nothing more for 10 minutes', async () => {
    const { paths, deps, store, later } = setup([course(1), course(2), course(3), course(9, false)]);
    expect(await gradeSweep(deps, { max: SWEEP_MAX_OPEN })).toEqual({ read: 3, markedDone: 1 * 3 });
    expect(paths).toEqual(['/grade/report/user/index.php?id=1', '/grade/report/user/index.php?id=2', '/grade/report/user/index.php?id=3']);
    // Graded assignments never seen in the calendar joined the history.
    expect(((await store.get(userKey(5, 'tasks'))) as unknown[]).length).toBe(3);
    later(SWEEP_GAP_SEC - 1);
    expect(await gradeSweep(deps, { max: SWEEP_MAX_OPEN })).toEqual({ read: 0, markedDone: 0 });
    // After the gap, a course is read again only after its hour.
    later(2);
    expect(await gradeSweep(deps, { max: SWEEP_MAX_OPEN })).toEqual({ read: 0, markedDone: 0 });
    later(COURSE_SWEEP_FRESH_SEC);
    expect(await gradeSweep(deps, { max: 1 })).toEqual({ read: 1, markedDone: 0 });
    expect(paths).toHaveLength(4);
  });
  it('leaves room in the 5-minute window for syncs, so it never brings on the 30-minute pause', async () => {
    const courses = Array.from({ length: 12 }, (_, i) => course(i + 1));
    const recent = Array.from({ length: 4 }, () => NOW - 30);
    const { paths, deps } = setup(courses, { [BUDGET_KEY]: { date: '2026-11-27', used: 4, recent } });
    // 10 in the window, 3 kept for syncs, 4 already sent: 3 now.
    expect((await gradeSweep(deps, { max: SWEEP_MAX_OPEN })).read).toBe(3);
    expect(paths).toHaveLength(3);
  });
  it('keeps the day\'s last requests for syncs, and never runs with an ended session', async () => {
    const low = setup([course(1)], { [BUDGET_KEY]: { date: '2026-11-27', used: 135 } });
    expect(await gradeSweep(low.deps, { max: SWEEP_MAX_OPEN })).toEqual({ read: 0, markedDone: 0 });
    const ended = setup([course(1)], { [SESSION_KEY]: { state: 'EXPIRED', userId: 5, checkedAt: NOW } });
    expect(await gradeSweep(ended.deps, { max: SWEEP_MAX_OPEN })).toEqual({ read: 0, markedDone: 0 });
    expect([...low.paths, ...ended.paths]).toHaveLength(0);
  });
  it('a refusal stops it; a report Sulo cannot read is skipped from then on', () => {
    expect(reportDue(undefined, NOW)).toBe(true);
    expect(reportDue({ fetchedAt: null, requestAt: NOW, unreadable: true }, NOW + 99_999)).toBe(false);
    expect(reportDue({ fetchedAt: null, requestAt: NOW - 60, }, NOW)).toBe(false);
    expect(reportDue({ fetchedAt: NOW - COURSE_SWEEP_FRESH_SEC, requestAt: NOW - COURSE_SWEEP_FRESH_SEC }, NOW)).toBe(true);
  });
});
