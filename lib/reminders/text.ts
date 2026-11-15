// Turns a planned notice into notification text in the chosen language.
// Short title and body, following the glossaries. Never grades or other
// sensitive data: only task name, course name and due time.

import { formatDueClock, formatLeft } from '../format/time';
import type { Messages } from '../i18n';
import type { Task, UnixSeconds } from '../types';
import { dueShift, isMovedEarlier } from '../radar/describe';
import { categoryOf, type UpdateCategory } from '../radar/settings';
import type { ChangeLogEntry, CourseId } from '../types';
import type { Notice } from './plan';

export type NotifyIcon = 'idle' | 'urgent' | 'sleepy' | 'happy';

export interface NotificationView {
  title: string;
  message: string;
  icon: NotifyIcon;
  /** Button labels: "Tunda 1 jam" and "Tandai selesai" for a single task, none otherwise. */
  buttons: string[];
}

// Short enough that the system never cuts off the time at the end of the title.
const MAX_NAME = 40;
export const shorten = (name: string) => (name.length > MAX_NAME ? `${name.slice(0, MAX_NAME - 1).trimEnd()}…` : name);

const DAY = 86_400;

export function noticeView(
  notice: Notice,
  ctx: { now: UnixSeconds; timeZone: string; m: Messages; courseName: (task: Task) => string; courseNameById?: (id: CourseId | null) => string | null },
): NotificationView {
  const { now, timeZone, m } = ctx;
  const n = m.notify;
  const left = (t: Task) => formatLeft(t.dueAt as UnixSeconds, now, timeZone, m);
  switch (notice.kind) {
    case 'task': {
      const t = notice.task;
      return {
        title: n.taskTitle(shorten(t.name), left(t)),
        message: n.taskBody(ctx.courseName(t), formatDueClock(t.dueAt as UnixSeconds, now, timeZone, m)),
        icon: (t.dueAt as UnixSeconds) - now <= DAY ? 'urgent' : 'idle',
        buttons: [n.snoozeButton, n.doneButton],
      };
    }
    case 'summary':
      return { title: n.summaryTitle(notice.count), message: n.summaryBody(shorten(notice.nearest.name), left(notice.nearest)), icon: 'idle', buttons: [] };
    case 'morning':
      return {
        title: n.morningTitle,
        message: n.morningBody(notice.today, notice.week, shorten(notice.nearest.name), left(notice.nearest)),
        icon: 'idle',
        buttons: [],
      };
    case 'session':
      return { title: notice.repeat ? n.sessionRepeatTitle : n.sessionTitle, message: n.sessionBody, icon: 'sleepy', buttons: [] };
    case 'changes':
      return changesView(notice.entries, ctx.courseNameById?.(notice.courseId) ?? null, ctx);
    case 'changes_summary':
      return { title: n.changesSummaryTitle(notice.count, notice.courses), message: n.changesSummaryBody, icon: 'idle', buttons: [] };
  }
}

type Bucket = UpdateCategory | 'tasks';

/** Updates for one course: one kind gets a specific line, several kinds a count per kind. */
function changesView(entries: readonly ChangeLogEntry[], course: string | null, ctx: { now: UnixSeconds; timeZone: string; m: Messages }): NotificationView {
  const { m, timeZone, now } = ctx;
  const n = m.notify;
  const changes = entries.map((e) => e.change);
  const icon: NotifyIcon = changes.some(isMovedEarlier) ? 'urgent' : changes.some((c) => c.kind === 'grade_feedback') ? 'happy' : 'idle';
  const bucket = (c: (typeof changes)[number]): Bucket => (c.kind === 'task_added' ? 'tasks' : (categoryOf(c) ?? 'materials'));
  const buckets = new Map<Bucket, typeof changes>();
  for (const c of changes) buckets.set(bucket(c), [...(buckets.get(bucket(c)) ?? []), c]);
  const nameOf = (c: (typeof changes)[number]) => ('name' in c ? shorten(c.name) : 'notification' in c ? shorten(c.notification.subject) : '');
  const list = (cs: typeof changes) => n.names(cs.slice(0, 2).map(nameOf), Math.max(0, cs.length - 2));
  const place = course ?? m.popup.updates.otherCourse;

  if (buckets.size > 1) {
    const parts = [...buckets.entries()].map(([b, cs]) => n.parts[b](cs.length));
    return { title: n.changesMixed(changes.length, course), message: `${parts.join(', ')}.`, icon, buttons: [] };
  }
  const [only, cs] = [...buckets.entries()][0]!;
  const first = cs[0]!;
  switch (only) {
    case 'materials':
      return { title: n.changesMaterials(cs.length, place), message: list(cs), icon, buttons: [] };
    case 'tasks': {
      if (cs.length === 1 && first.kind === 'task_added') {
        const due = first.dueAt === null ? `${shorten(first.name)}.` : n.taskBody(shorten(first.name), formatDueClock(first.dueAt, now, timeZone, m));
        return { title: n.changesTasks(1, place), message: due, icon, buttons: [] };
      }
      return { title: n.changesTasks(cs.length, place), message: list(cs), icon, buttons: [] };
    }
    case 'deadlines': {
      if (cs.length === 1 && first.kind === 'due_changed') {
        const message = first.to === null ? `${course ?? ''}`.trim() || first.name : n.dueBody(course ?? '', formatDueClock(first.to, now, timeZone, m));
        return { title: n.changesDue(shorten(first.name), dueShift(first.from, first.to, timeZone, m)), message, icon, buttons: [] };
      }
      return { title: n.changesMixed(cs.length, course), message: `${n.parts.deadlines(cs.length)}: ${list(cs)}`, icon, buttons: [] };
    }
    case 'grades':
      // Never the grade or the comment: only that there is something new, and where.
      return { title: n.changesGrade(course), message: n.gradeBody, icon, buttons: [] };
    case 'forum':
      return { title: n.changesForum(course), message: list(cs), icon, buttons: [] };
  }
}
