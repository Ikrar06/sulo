import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCall } from '@sulo/core/moodle/schemas';
import { KEEP_MAX_DAYS, keepUntil, mergeTasks, SEMESTER_FALLBACK_DAYS, SEMESTER_GRACE_DAYS, taskFromEvent, upcomingCourseIds } from '@sulo/core/tasks/from-calendar';
import { badgeCount, groupTasks, pendingTasks, urgencyOf } from '@sulo/core/tasks/group';
import { getTaskState, pruneTaskState, setDone, setSnooze } from '@sulo/core/tasks/local-state';
import type { Task } from '@sulo/core/types';

const DAY = 86_400;
const HOUR = 3600;
const TZ = 'Asia/Makassar';
// 2026-09-22 12:00 WITA
const NOW = Date.UTC(2026, 8, 22, 4, 0, 0) / 1000;

const events = () => {
  const data = JSON.parse(readFileSync(new URL('../fixtures/synthetic/calendar-action-events.normal.json', import.meta.url), 'utf8'));
  const parsed = parseCall('core_calendar_get_action_events_by_timesort', { ok: true, data });
  if (!parsed.ok) throw new Error('fixture invalid');
  return parsed.data.events;
};

const task = (eventId: number, dueAt: number | null, extra: Partial<Task> = {}): Task => ({
  eventId,
  cmId: null,
  courseId: 401,
  name: `Tugas ${eventId}`,
  module: 'assign',
  dueAt,
  url: '',
  overdue: false,
  firstSeenAt: NOW,
  lastSeenAt: NOW,
  missingSince: null,
  ...extra,
});

describe('tasks from the calendar', () => {
  it('maps events with the module code, cmid and course, including quiz deadlines', () => {
    const tasks = events().map((e) => taskFromEvent(e, NOW));
    expect(tasks.map((t) => [t.module, t.cmId, t.courseId])).toEqual([
      ['assign', 301, 401],
      ['quiz', 305, 402],
      ['assign', 306, 403],
    ]);
  });

  it('uses the activity name without Moodle\'s "is due" or "closes" suffix', () => {
    const tasks = events().map((e) => taskFromEvent(e, NOW));
    expect(tasks.map((t) => t.name)).toEqual(['Laporan praktikum aliran saluran terbuka', 'Kuis pekan 5', 'Rancangan tata guna lahan']);
    const fallback = taskFromEvent({ ...events()[0]!, activityname: undefined }, NOW);
    expect(fallback.name).toBe('Laporan praktikum aliran saluran terbuka is due');
  });

  it('keeps firstSeenAt across syncs', () => {
    const [first] = mergeTasks([], events(), NOW - DAY, 14);
    const [again] = mergeTasks([first!], events(), NOW, 14);
    expect(again?.firstSeenAt).toBe(NOW - DAY);
    expect(again?.lastSeenAt).toBe(NOW);
  });

  it('marks a vanished task as probably submitted instead of deleting it', () => {
    const kept = mergeTasks([task(999, NOW + DAY)], [], NOW, 14);
    expect(kept).toEqual([task(999, NOW + DAY, { missingSince: NOW })]);
  });

  it('keeps a gone task until its course ends, plus a grace for late grades', () => {
    const gone = task(999, NOW - 60 * DAY, { missingSince: NOW - 55 * DAY });
    const ends = (at: number | null) => new Map([[401, at]]);
    // The course ends in a month: kept, long after the old 14 days.
    expect(mergeTasks([gone], [], NOW, 14, ends(NOW + 30 * DAY))).toEqual([gone]);
    // Ended more than the grace ago: dropped.
    expect(mergeTasks([gone], [], NOW, 14, ends(NOW - (SEMESTER_GRACE_DAYS + 1) * DAY))).toEqual([]);
    expect(mergeTasks([gone], [], NOW, 14, ends(NOW - (SEMESTER_GRACE_DAYS - 1) * DAY))).toEqual([gone]);
  });

  it(`without a course end, keeps it ${SEMESTER_FALLBACK_DAYS} days after its due date, never more than ${KEEP_MAX_DAYS}`, () => {
    const due = NOW - 100 * DAY;
    expect(keepUntil({ dueAt: due, missingSince: NOW, firstSeenAt: due }, null)).toBe(due + SEMESTER_FALLBACK_DAYS * DAY);
    // A course end years away (a wrong date) is capped.
    expect(keepUntil({ dueAt: due, missingSince: NOW, firstSeenAt: due }, NOW + 900 * DAY)).toBe(due + KEEP_MAX_DAYS * DAY);
    expect(mergeTasks([task(999, NOW - (SEMESTER_FALLBACK_DAYS + 1) * DAY, { missingSince: NOW - DAY })], [], NOW, 14)).toEqual([]);
  });

  it('keeps a task that only fell out of the requested window as past, not probably submitted', () => {
    expect(mergeTasks([task(999, NOW - 20 * DAY)], [], NOW, 14)).toEqual([task(999, NOW - 20 * DAY, { missingSince: NOW, pastWindow: true })]);
    // Gone while still inside the window (handed in): it stays "probably submitted" after its date leaves it.
    const handedIn = task(998, NOW - 20 * DAY, { missingSince: NOW - 10 * DAY });
    expect(mergeTasks([handedIn], [], NOW, 14)).toEqual([handedIn]);
  });

  it('a past task back in the calendar (a new due date) is active again', () => {
    const past = task(301, NOW - 20 * DAY, { missingSince: NOW - DAY, pastWindow: true });
    const [back] = mergeTasks([past], [{ ...events()[0]!, id: 301 }], NOW, 14);
    expect(back?.missingSince).toBeNull();
    expect(back?.pastWindow).toBeUndefined();
  });

  it('lists courses with upcoming deadlines', () => {
    expect(upcomingCourseIds([task(1, NOW + HOUR), task(2, NOW - HOUR, { courseId: 402 })], NOW)).toEqual(new Set([401]));
  });
});

describe('grouping and urgency', () => {
  const tonight = Date.UTC(2026, 8, 22, 15, 59) / 1000; // 23.59 WITA today
  const tomorrow = Date.UTC(2026, 8, 23, 15, 59) / 1000;
  const inFiveDays = NOW + 5 * DAY;
  const nextMonth = NOW + 30 * DAY;

  it('groups by local day', () => {
    const groups = groupTasks(
      [task(1, nextMonth), task(2, NOW - HOUR), task(3, tomorrow), task(4, tonight), task(5, inFiveDays), task(6, null)],
      NOW,
      TZ,
    );
    expect(Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.map((t) => t.eventId)]))).toEqual({
      overdue: [2],
      soon: [4, 3],
      week: [5],
      later: [1],
      undated: [6],
    });
  });

  it('uses the local day of the given time zone, not UTC', () => {
    // 01.00 WITA tomorrow is still "today" in UTC.
    const earlyTomorrow = Date.UTC(2026, 8, 22, 17, 0) / 1000;
    expect(groupTasks([task(1, earlyTomorrow)], NOW, TZ).soon).toHaveLength(1);
    expect(groupTasks([task(1, NOW + 6.5 * DAY)], NOW, 'America/New_York').week).toHaveLength(1);
  });

  it('computes urgency and the badge count (overdue plus under 24 hours)', () => {
    expect([NOW - 1, NOW + 2 * HOUR, NOW + 48 * HOUR, NOW + 5 * DAY, null].map((d) => urgencyOf(d, NOW))).toEqual([
      'overdue',
      'day',
      'threeDays',
      'normal',
      'normal',
    ]);
    expect(badgeCount([task(1, NOW - DAY), task(2, NOW + 23 * HOUR), task(3, NOW + 25 * HOUR), task(4, null)], NOW)).toBe(2);
  });

  it('pending tasks exclude inactive courses, done and probably-submitted tasks', () => {
    const state = setDone({}, 2, true);
    const pending = pendingTasks(
      [task(1, NOW), task(2, NOW), task(3, NOW, { courseId: 999 }), task(4, NOW, { missingSince: NOW })],
      state,
      new Set([401]),
    );
    expect(pending.map((t) => t.eventId)).toEqual([1]);
  });
});

describe('local task state', () => {
  it('marks done and snoozes without mutating the input', () => {
    const empty = {};
    const done = setDone(empty, 7, true);
    const snoozed = setSnooze(done, 7, NOW + HOUR);
    expect(empty).toEqual({});
    expect(getTaskState(snoozed, 7)).toMatchObject({ doneManually: true, snoozedUntil: NOW + HOUR });
    expect(pruneTaskState(snoozed, new Set([8]))).toEqual({});
  });
});
