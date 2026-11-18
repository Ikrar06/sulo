import { describe, expect, it } from 'vitest';
import { planReminders, type PlanInput } from '@sulo/core/reminders/plan';
import { DEFAULT_REMINDERS } from '@sulo/core/reminders/settings';
import { EMPTY_UNDO, markDone, undoDone, undoReducer } from '@sulo/core/tasks/done-undo';
import { getTaskState } from '@sulo/core/tasks/local-state';
import type { Task } from '@sulo/core/types';

const TZ = 'Asia/Makassar';
const H = 3600;
const at = (y: number, mo: number, d: number, h: number, mi = 0) => Date.UTC(y, mo - 1, d, h - 8, mi) / 1000; // WITA wall time

const task = (eventId: number, dueAt: number | null, patch: Partial<Task> = {}): Task => ({
  eventId, cmId: null, courseId: 1, name: `Tugas ${eventId}`, module: 'assign', dueAt, url: `https://x/${eventId}`,
  overdue: false, firstSeenAt: 0, lastSeenAt: 0, missingSince: null, ...patch,
});

const base = (now: number, tasks: Task[], patch: Partial<PlanInput> = {}): PlanInput => ({
  now, timeZone: TZ, tasks, taskState: {}, activeCourseIds: new Set([1]), settings: DEFAULT_REMINDERS, sent: {},
  session: { state: 'OK', expiredAt: null }, ...patch,
});

describe('mark done with Urungkan', () => {
  it('marking keeps the row in place and shows the toast for that task', () => {
    const s = undoReducer(EMPTY_UNDO, { kind: 'mark', eventId: 7 });
    expect(s).toEqual({ toast: 7, lingering: [7] });
    expect(getTaskState(markDone({}, 7), 7).doneManually).toBe(true);
  });

  it('Urungkan restores the latest task and closes the toast', () => {
    const s = undoReducer(undoReducer(EMPTY_UNDO, { kind: 'mark', eventId: 7 }), { kind: 'undo' });
    expect(s).toEqual({ toast: null, lingering: [] });
    expect(getTaskState(undoDone(markDone({}, 7), 7), 7).doneManually).toBe(false);
  });

  it('after 5 seconds the row stops lingering and the toast closes', () => {
    const s = undoReducer(undoReducer(EMPTY_UNDO, { kind: 'mark', eventId: 7 }), { kind: 'expire', eventId: 7 });
    expect(s).toEqual({ toast: null, lingering: [] });
  });

  it('several in a row: the toast follows the latest; Urungkan only restores that one', () => {
    let s = undoReducer(EMPTY_UNDO, { kind: 'mark', eventId: 1 });
    s = undoReducer(s, { kind: 'mark', eventId: 2 });
    expect(s).toEqual({ toast: 2, lingering: [1, 2] });
    // The first one's window ends; the toast still belongs to the second.
    s = undoReducer(s, { kind: 'expire', eventId: 1 });
    expect(s).toEqual({ toast: 2, lingering: [2] });
    s = undoReducer(s, { kind: 'undo' });
    expect(s).toEqual({ toast: null, lingering: [] });
    expect(undoReducer(s, { kind: 'undo' })).toBe(s);
  });

  it("reminders are dropped as soon as a task is marked, and come back with Urungkan", () => {
    const due = at(2026, 11, 20, 23, 59);
    const t = task(1, due);
    const now = due - 3 * H;
    const before = planReminders(base(now, [t]));
    expect(before.send.some((n) => n.kind === 'task')).toBe(true);
    const marked = planReminders(base(now, [t], { taskState: markDone({}, 1) }));
    expect(marked.send.some((n) => n.kind === 'task')).toBe(false);
    const undone = planReminders(base(now, [t], { taskState: undoDone(markDone({}, 1), 1) }));
    expect(undone.send).toEqual(before.send);
  });
});
