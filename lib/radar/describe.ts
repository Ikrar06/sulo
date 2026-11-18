// Words for changes, shared by notifications and the "Kabar terbaru" panel.
// Pure; takes the active dictionary.

import { isNewTaskActivity } from './task-modules';
import { calendarDaysBetween } from '../format/time';
import type { Messages } from '../i18n';
import type { Change, UnixSeconds } from '../types';

/** "diundur 3 hari", "dimajukan 5 jam", "sekarang punya tenggat". */
export function dueShift(from: UnixSeconds | null, to: UnixSeconds | null, timeZone: string, m: Pick<Messages, 'time'>): string {
  if (to === null) return m.time.dueRemoved;
  if (from === null) return m.time.dueSet;
  const diff = to - from;
  const abs = Math.abs(diff);
  const days = Math.abs(calendarDaysBetween(from, to, timeZone));
  const amount =
    abs >= 12 * 3600 && days >= 1 ? m.time.days(days) : abs >= 3600 ? m.time.hours(Math.round(abs / 3600)) : m.time.minutes(Math.max(1, Math.round(abs / 60)));
  return diff > 0 ? m.time.later(amount) : m.time.earlier(amount);
}

/** One line in the panel. Subjects come from Moodle as display text only. */
export function describeChange(change: Change, timeZone: string, m: Messages): string {
  const u = m.popup.updates;
  switch (change.kind) {
    case 'added':
      return isNewTaskActivity(change) ? u.taskAdded(change.name) : u.added(change.name);
    case 'shown':
      return isNewTaskActivity(change) ? u.taskAdded(change.name) : u.shown(change.name);
    case 'hidden':
      return u.hidden(change.name);
    case 'removed':
      return u.removed(change.name);
    case 'renamed':
      return u.renamed(change.from, change.to);
    case 'task_added':
      return u.taskAdded(change.name);
    case 'due_changed':
      return u.dueChanged(change.name, dueShift(change.from, change.to, timeZone, m));
    case 'grade_feedback':
      return u.grade;
    case 'neosia_grade':
      return m.notify.neosiaGrade(change.name);
    case 'forum':
    case 'other_notification':
      return change.notification.subject;
  }
}

/** Where a click on the entry goes; null when there is no page to open. */
export function changeUrl(change: Change): string | null {
  switch (change.kind) {
    case 'added':
    case 'shown':
    case 'renamed':
      return change.url;
    case 'task_added':
    case 'due_changed':
      return change.url || null;
    case 'grade_feedback':
    case 'forum':
    case 'other_notification':
      return change.notification.contexturl;
    default:
      return null;
  }
}

/** Earlier deadline: worth the urgent mascot. */
export const isMovedEarlier = (c: Change) => c.kind === 'due_changed' && c.from !== null && c.to !== null && c.to < c.from;
