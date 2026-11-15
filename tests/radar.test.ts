import { describe, expect, it } from 'vitest';
import gradesFx from '../fixtures/synthetic/popup-notifications.grades.json';
import stateFx from '../fixtures/synthetic/courseformat-state.normal.json';
import { parseCall } from '../lib/moodle/schemas';
import { diffCourse } from '../lib/radar/diff';
import { appendChanges, countPopupOpen, LOG_LIMIT, markAllSeen, taskMarkers } from '../lib/radar/log';
import { notificationKind } from '../lib/radar/notification-kinds';
import { courseIdFromCustomdata, filterContextUrl, scanNotifications } from '../lib/radar/notifications';
import { pickCoursesToCheck } from '../lib/radar/schedule';
import { itemsFromState, type FreshItem } from '../lib/radar/snapshot';
import { diffTasks } from '../lib/radar/tasks-diff';
import type { Change, CourseSnapshot, Task } from '../lib/types';
import { PARSER_VERSION } from '../lib/types';

const ORIGIN = 'https://sikola-v2.unhas.ac.id';
const NOW = 1_795_000_000;
const H = 3600;
const ctx = { userId: 5, courseId: 401, now: NOW };

const item = (cmId: number, patch: Partial<FreshItem> = {}): FreshItem => ({
  cmId, module: 'resource', name: `Materi ${cmId}`, sectionId: 1, visible: true, uservisible: true, url: `${ORIGIN}/mod/resource/view.php?id=${cmId}`, ...patch,
});
const snap = (items: FreshItem[], patch: Partial<CourseSnapshot> = {}): CourseSnapshot => ({
  userId: 5, courseId: 401, fetchedAt: NOW - H, parserVersion: PARSER_VERSION,
  items: Object.fromEntries(items.map((i) => [String(i.cmId), { ...i, firstSeenAt: NOW - 10 * H, missCount: 0 }])), ...patch,
});

describe('course structure diff', () => {
  it('reads the course state with module codes, not translated modname', () => {
    const parsed = parseCall('core_courseformat_get_state', { ok: true, data: stateFx });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const items = itemsFromState(parsed.data);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => /^[a-z]+$/.test(i.module))).toBe(true);
  });

  it('treats the first snapshot of a course as a silent baseline', () => {
    const r = diffCourse(null, [item(1), item(2)], ctx);
    expect(r.baseline).toBe(true);
    expect(r.changes).toEqual([]);
    expect(Object.keys(r.next.items)).toEqual(['1', '2']);
  });

  it('treats a parser version bump as a silent baseline', () => {
    const r = diffCourse(snap([item(1)], { parserVersion: PARSER_VERSION - 1 }), [item(1), item(9)], ctx);
    expect(r.baseline).toBe(true);
    expect(r.changes).toEqual([]);
  });

  it('reports new activities', () => {
    const r = diffCourse(snap([item(1)]), [item(1), item(2, { module: 'assign', name: 'Laporan 4' })], ctx);
    expect(r.changes).toEqual([{ kind: 'added', courseId: 401, cmId: 2, module: 'assign', name: 'Laporan 4', url: `${ORIGIN}/mod/resource/view.php?id=2`, since: NOW - H }]);
  });

  it('counts a missing activity as removed only after 2 checks in a row', () => {
    const first = diffCourse(snap([item(1), item(2)]), [item(1)], ctx);
    expect(first.changes).toEqual([]);
    expect(first.next.items['2']?.missCount).toBe(1);
    const second = diffCourse(first.next, [item(1)], { ...ctx, now: NOW + 6 * H });
    expect(second.changes).toEqual([{ kind: 'removed', courseId: 401, cmId: 2, module: 'resource', name: 'Materi 2', since: NOW }]);
    expect(second.next.items['2']).toBeUndefined();
  });

  it('resets the miss count when an activity comes back', () => {
    const first = diffCourse(snap([item(1), item(2)]), [item(1)], ctx);
    const back = diffCourse(first.next, [item(1), item(2)], ctx);
    expect(back.changes).toEqual([]);
    expect(back.next.items['2']?.missCount).toBe(0);
  });

  it('records visibility changes as hidden and shown, also through uservisible', () => {
    const hidden = diffCourse(snap([item(1)]), [item(1, { visible: false })], ctx);
    expect(hidden.changes.map((c) => c.kind)).toEqual(['hidden']);
    const restricted = diffCourse(snap([item(1)]), [item(1, { uservisible: false })], ctx);
    expect(restricted.changes.map((c) => c.kind)).toEqual(['hidden']);
    const shown = diffCourse(snap([item(1, { visible: false })]), [item(1)], ctx);
    expect(shown.changes.map((c) => c.kind)).toEqual(['shown']);
  });

  it('records renames', () => {
    const r = diffCourse(snap([item(1)]), [item(1, { name: 'Materi 1 (revisi)' })], ctx);
    expect(r.changes).toEqual([{ kind: 'renamed', courseId: 401, cmId: 1, module: 'resource', from: 'Materi 1', to: 'Materi 1 (revisi)', url: `${ORIGIN}/mod/resource/view.php?id=1`, since: NOW - H }]);
  });
});

describe('structure check schedule', () => {
  const ids = [401, 402, 403, 404, 405, 406, 407];
  it('checks at most 5 courses, never-checked first, then the oldest', () => {
    const checked = { '401': NOW - 7 * H, '402': NOW - 20 * H, '403': NOW - H };
    expect(pickCoursesToCheck(ids, checked, NOW)).toEqual([404, 405, 406, 407, 402]);
  });

  it('waits 6 hours before checking a course again', () => {
    const all = Object.fromEntries(ids.map((id) => [String(id), NOW - 5 * H]));
    expect(pickCoursesToCheck(ids, all, NOW)).toEqual([]);
    expect(pickCoursesToCheck(ids, all, NOW + H)).toHaveLength(5);
  });

  it('rotates so every course is checked within a few cycles', () => {
    const checked: Record<string, number> = {};
    const seen = new Set<number>();
    for (let cycle = 0; cycle < 3; cycle++) {
      for (const id of pickCoursesToCheck([...ids, 408, 409, 410, 411], checked, NOW + cycle * 60)) {
        checked[String(id)] = NOW + cycle * 60;
        seen.add(id);
      }
    }
    expect(seen.size).toBe(11);
  });
});

describe('calendar changes', () => {
  const task = (eventId: number, dueAt: number | null, patch: Partial<Task> = {}): Task => ({
    eventId, cmId: eventId + 1000, courseId: 401, name: `Tugas ${eventId}`, module: 'assign', dueAt, url: `${ORIGIN}/mod/assign/view.php?id=${eventId + 1000}`,
    overdue: false, firstSeenAt: NOW, lastSeenAt: NOW, missingSince: null, ...patch,
  });

  it('is silent on the baseline', () => {
    expect(diffTasks([], [task(1, NOW + 9 * H)], true)).toEqual([]);
  });

  it('reports new tasks and changed due dates with old and new values', () => {
    const changes = diffTasks([task(1, NOW + 9 * H)], [task(1, NOW + 57 * H), task(2, NOW + 30 * H)], false);
    expect(changes.map((c) => c.kind)).toEqual(['due_changed', 'task_added']);
    expect(changes[0]).toMatchObject({ from: NOW + 9 * H, to: NOW + 57 * H });
  });

  it('ignores tasks that disappeared (kept as probably submitted)', () => {
    expect(diffTasks([task(1, NOW + 9 * H)], [task(1, NOW + 9 * H, { missingSince: NOW })], false)).toEqual([]);
  });
});

describe('Moodle notifications', () => {
  const parsed = parseCall('message_popup_get_popup_notifications', { ok: true, data: gradesFx });

  it('passes validation with every real field present, and drops message bodies', () => {
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    for (const n of parsed.data.notifications) {
      for (const field of ['text', 'fullmessage', 'fullmessagehtml', 'smallmessage', 'useridfrom', 'iconurl', 'timecreatedpretty']) {
        expect(n).not.toHaveProperty(field);
      }
    }
  });

  it('recognises kinds from component and eventtype, never the subject', () => {
    expect(notificationKind('mod_assign', 'assign_notification')).toBe('grade_feedback');
    expect(notificationKind('gradingform', 'gradingform_notification')).toBe('grade_feedback');
    expect(notificationKind('mod_forum', 'posts')).toBe('forum');
    expect(notificationKind('mod_forum', 'something_new')).toBe('forum');
    expect(notificationKind('moodle', 'newlogin')).toBe('other');
  });

  it('takes the first fetch as a baseline, then only newer ids', () => {
    if (!parsed.ok) throw new Error('fixture');
    const first = scanNotifications(parsed.data.notifications, null, ORIGIN);
    expect(first).toEqual({ changes: [], lastId: 705, baseline: true });
    const later = scanNotifications(parsed.data.notifications, 702, ORIGIN);
    expect(later.changes.map((c) => c.kind)).toEqual(['forum', 'forum', 'other_notification']);
    expect(later.lastId).toBe(705);
  });

  it('keeps only the allowed fields, a filtered link and the course id', () => {
    if (!parsed.ok) throw new Error('fixture');
    const [grade, , forum, digest] = scanNotifications(parsed.data.notifications, 700, ORIGIN).changes;
    expect(grade).toEqual({
      kind: 'grade_feedback',
      courseId: 401,
      notification: {
        id: 701, subject: 'Tugas Laporan 3 sudah dinilai', component: 'mod_assign', eventtype: 'assign_notification',
        timecreated: 1795000701, read: false, contexturl: `${ORIGIN}/mod/assign/view.php?id=901`,
      },
    });
    expect(forum).toMatchObject({ courseId: 402, notification: { contexturl: `${ORIGIN}/mod/forum/discuss.php?d=77#p345` } });
    // Unreadable customdata and a foreign link: still logged, without course or link.
    expect(digest).toMatchObject({ courseId: null, notification: { contexturl: null } });
    expect(JSON.stringify(grade)).not.toMatch(/87|Komentar|customdata|sesskey/);
  });

  it('filters context links strictly', () => {
    expect(filterContextUrl(`${ORIGIN}/grade/report/user/index.php?id=401&userid=9`, ORIGIN)).toBe(`${ORIGIN}/grade/report/user/index.php?id=401`);
    expect(filterContextUrl(`${ORIGIN}/user/profile.php?id=9`, ORIGIN)).toBeNull();
    expect(filterContextUrl('javascript:alert(1)', ORIGIN)).toBeNull();
    expect(filterContextUrl(null, ORIGIN)).toBeNull();
    expect(courseIdFromCustomdata('{"courseid":"x"}')).toBeNull();
    expect(courseIdFromCustomdata(undefined)).toBeNull();
  });
});

describe('change log', () => {
  const added = (cmId: number, module = 'resource'): Change => ({ kind: 'added', courseId: 401, cmId, module, name: 'X', url: null, since: NOW - 6 * H });
  const taskAdded = (eventId: number, cmId: number | null, dueAt: number | null = NOW + 48 * H): Change => ({
    kind: 'task_added', courseId: 401, eventId, cmId, name: 'Laporan', dueAt, url: '',
  });

  it('notifies new material and tasks, but not labels, renames, removals or other notifications', () => {
    const log = appendChanges([], [added(1), added(2, 'label'), { kind: 'renamed', courseId: 401, cmId: 3, module: 'page', from: 'a', to: 'b', url: null, since: NOW - 6 * H }, taskAdded(10, null)], NOW);
    expect(log.map((e) => [e.change.kind, e.notify])).toEqual([
      ['added', true],
      ['added', false],
      ['renamed', false],
      ['task_added', true],
    ]);
  });

  it('announces one activity once, whichever source sees it first', () => {
    const calendarFirst = appendChanges([], [taskAdded(10, 77)], NOW);
    const thenStructure = appendChanges(calendarFirst, [added(77, 'assign')], NOW + 6 * H);
    expect(thenStructure[0]).toMatchObject({ notify: false });
    const structureFirst = appendChanges([], [added(78, 'assign')], NOW);
    const thenCalendar = appendChanges(structureFirst, [taskAdded(11, 78)], NOW + H);
    expect(thenCalendar[0]).toMatchObject({ notify: false });
  });

  it('logs a task that only entered the 90-day window without notifying', () => {
    const [entry] = appendChanges([], [taskAdded(12, null, NOW + 88 * 86_400)], NOW);
    expect(entry?.notify).toBe(false);
  });

  it('never logs the same change twice and keeps the newest 200', () => {
    const once = appendChanges([], [taskAdded(10, null)], NOW);
    expect(appendChanges(once, [taskAdded(10, null)], NOW + 60)).toHaveLength(1);
    const many = Array.from({ length: 250 }, (_, i) => taskAdded(1000 + i, null));
    const log = appendChanges([], many, NOW);
    expect(log).toHaveLength(LOG_LIMIT);
    expect(markAllSeen(log).every((e) => e.seen)).toBe(true);
  });

  it('shows the "baru" marker for 24 hours or 3 popup opens', () => {
    let log = appendChanges([], [taskAdded(10, null)], NOW);
    expect(taskMarkers(log, NOW + H).get(10)).toBe('new');
    expect(taskMarkers(log, NOW + 25 * H).size).toBe(0);
    for (let i = 0; i < 3; i++) log = countPopupOpen(log, NOW + H);
    expect(taskMarkers(log, NOW + 2 * H).size).toBe(0);
  });

  it('gives the same change from two overlapping cycles one id, one entry and one notification', () => {
    const prev = snap([item(1)]);
    const a = diffCourse(prev, [item(1), item(2)], { ...ctx, now: NOW });
    const b = diffCourse(prev, [item(1), item(2)], { ...ctx, now: NOW + 30 });
    const log = appendChanges(appendChanges([], a.changes, NOW), b.changes, NOW + 30);
    expect(log).toHaveLength(1);
    expect(log[0]?.notify).toBe(true);
  });

  it('still records a real repeat later (hidden, shown, hidden again)', () => {
    const hidden1 = diffCourse(snap([item(1)]), [item(1, { visible: false })], ctx);
    const shown = diffCourse(hidden1.next, [item(1)], { ...ctx, now: NOW + 6 * H });
    const hidden2 = diffCourse(shown.next, [item(1, { visible: false })], { ...ctx, now: NOW + 12 * H });
    const log = [hidden1, shown, hidden2].reduce((l, d, i) => appendChanges(l, d.changes, NOW + i * 6 * H), [] as ReturnType<typeof appendChanges>);
    expect(log.map((e) => e.change.kind)).toEqual(['hidden', 'shown', 'hidden']);
  });
});
