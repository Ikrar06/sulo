// The full morning summary (M8c.3, the Android app): overdue tasks, due
// today, due tomorrow, today's academic calendar events and, with NEOSIA's
// schedule, today's classes (name and time only), from the data on the phone. Nothing in any of them: no summary (the day still counts
// as handled). The extension keeps its own summary (planner "classic").
// Pure, plus one reader of the stored data for the debug screen's preview.

import { activeCourseIds } from '../courses/active-score';
import { calendarDaysBetween } from '../format/time';
import { messagesFor, resolveLocale, type Messages } from '../i18n';
import { readPrefs } from '../prefs';
import { readCalendar } from '../calendar/remote';
import type { CalendarEventLite } from '../calendar/notify';
import { currentUser, readUser } from '../storage';
import { getTaskState, type TaskStateMap } from '../tasks/local-state';
import { applyPersonalDue } from '../tasks/personal-due';
import type { CourseId, KeyValueStore, Task, UnixSeconds } from '../types';
import type { NotificationView } from './text';
import { localParts } from './zoned';
import { followsTask, withOwnTasks } from '../tasks/own';

export interface MorningCounts {
  overdue: number;
  today: number;
  tomorrow: number;
  /** Names of the calendar events starting or ending today. */
  events: string[];
  /** Today's classes from NEOSIA's schedule (name and start, never a grade); empty without it. */
  classes?: MorningClass[];
}

/** One class in the morning summary: the course's name as Sulo shows it, and its local start ("07:30"). */
export interface MorningClass {
  name: string;
  start: string;
}

/** Pending tasks Sulo reminds about, overdue ones included. */
export function pendingForMorning(tasks: readonly Task[], taskState: TaskStateMap, active: ReadonlySet<CourseId>): Task[] {
  return tasks.filter((t) => t.dueAt !== null && t.missingSince === null && followsTask(active, t) && !getTaskState(taskState, t.eventId).doneManually);
}

/** The counts for the morning at `now`, or null when there is nothing to say. */
export function morningCounts(now: UnixSeconds, timeZone: string, pending: readonly Task[], events: readonly CalendarEventLite[], classes: readonly MorningClass[] = []): MorningCounts | null {
  const today = localParts(now, timeZone).dateKey;
  let overdue = 0;
  let dueToday = 0;
  let tomorrow = 0;
  for (const t of pending) {
    const due = t.dueAt as UnixSeconds;
    if (due < now) overdue += 1;
    else {
      const days = calendarDaysBetween(now, due, timeZone);
      if (days === 0) dueToday += 1;
      else if (days === 1) tomorrow += 1;
    }
  }
  const todays = events.filter((e) => !e.perkiraan && e.audiens !== 'calon_mahasiswa' && (e.mulai === today || (e.selesai ?? e.mulai) === today)).map((e) => e.judul);
  const names = [...new Set(todays)];
  if (overdue === 0 && dueToday === 0 && tomorrow === 0 && names.length === 0 && classes.length === 0) return null;
  return { overdue, today: dueToday, tomorrow, events: names, ...(classes.length > 0 ? { classes: [...classes] } : {}) };
}

/** The notification text, in the user's language, from the counts. */
export function morningFullView(c: MorningCounts, m: Messages): NotificationView {
  const n = m.notify;
  return { title: n.morningFullTitle, message: n.morningFullBody(c.overdue, c.today, c.tomorrow, c.events, c.classes ?? []), icon: c.overdue > 0 ? 'urgent' : 'idle', buttons: [] };
}

/** The debug screen's preview: the full summary for now from the stored data (ignores the "every morning" switch). */
export async function previewMorning(store: KeyValueStore, now: UnixSeconds, timeZone: string, uiLanguage: string): Promise<{ view: NotificationView | null; enabled: boolean }> {
  const prefs = await readPrefs(store);
  const enabled = prefs.reminders.enabled && prefs.reminders.morning.enabled;
  const userId = await currentUser(store);
  if (userId === null) return { view: null, enabled };
  const [sikola, own, taskState, courses, calendar] = await Promise.all([readUser(store, userId, 'tasks'), readUser(store, userId, 'ownTasks'), readUser(store, userId, 'taskState'), readUser(store, userId, 'courses'), readCalendar(store)]);
  // The tasks the student added count as well (tasks/own.ts).
  const tasks = withOwnTasks(sikola, own);
  const pending = pendingForMorning(applyPersonalDue(tasks, taskState).tasks, taskState, activeCourseIds(courses));
  const counts = morningCounts(now, timeZone, pending, calendar.kegiatan);
  return { view: counts ? morningFullView(counts, messagesFor(resolveLocale(prefs.locale, uiLanguage))) : null, enabled };
}
