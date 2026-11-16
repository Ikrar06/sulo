// One notification cycle: load stored data, plan, record keys, show.
// Dependencies (store, time, notifier) are injected so this runs in Vitest;
// the background supplies chrome.notifications and sets the rolling alarm
// to the returned nextAt.
//
// Keys are recorded BEFORE a notification is shown. Losing one reminder
// stage (if showing fails or the worker dies in between) is acceptable,
// because a later stage still comes; a double notification is not. A failed
// show is counted in local stats so it is visible during testing.

import { activeCourseIds } from '../courses/active-score';
import { courseAlias } from '../courses/display-name';
import { messagesFor, resolveLocale } from '../i18n';
import { readSession } from '../moodle/session';
import { readPrefs } from '../prefs';
import { currentUser, readUser, writeUserIfCurrent } from '../storage';
import { readPending } from '../account/pending';
import { applyPersonalDue } from '../tasks/personal-due';
import { readCalendar } from '../calendar/remote';
import type { KeyValueStore, Task, UnixSeconds } from '../types';
import { planReminders, type Notice } from './plan';
import { noticeView, type NotificationView } from './text';

/** Recorded keys are kept this long, then pruned. */
const KEEP_SENT = 30 * 86_400;

export interface Notifier {
  /** Shows a notification; throws when it could not be created. */
  show(id: string, view: NotificationView): Promise<void>;
}

export interface CycleDeps {
  store: KeyValueStore;
  now: UnixSeconds;
  timeZone: string;
  uiLanguage: string;
  notifier: Notifier;
}

/** Notification ids carry what a click needs: "task|eventId|key", "summary|…", "morning|…", "session|…". */
export function notificationId(notice: Notice): string {
  if (notice.kind === 'task') return `task|${notice.task.eventId}|${notice.key}`;
  // A single update carries its log entry id, so a click can open its page.
  if (notice.kind === 'changes' && notice.entries.length === 1) return `changes|${notice.entries[0]!.id}`;
  return `${notice.kind}|${notice.key}`;
}

export function parseNotificationId(id: string): { kind: string; eventId: number | null; entryId: string | null } {
  const [kind = '', second] = id.split('|');
  return { kind, eventId: kind === 'task' && second ? Number(second) : null, entryId: kind === 'changes' && second ? second : null };
}

/** Drops old keys and keys of tasks that no longer exist. */
export function pruneSent(sent: Record<string, UnixSeconds>, now: UnixSeconds, taskIds: ReadonlySet<number>): Record<string, UnixSeconds> {
  return Object.fromEntries(
    Object.entries(sent).filter(([key, at]) => {
      if (now - at > KEEP_SENT) return false;
      const task = /^t:(\d+):/.exec(key);
      return !task || taskIds.has(Number(task[1]));
    }),
  );
}

export async function runNotifyCycle(deps: CycleDeps): Promise<{ nextAt: UnixSeconds | null; shown: number; shownKinds?: Notice['kind'][] }> {
  const { store, now, timeZone } = deps;
  const userId = await currentUser(store);
  if (userId === null) return { nextAt: null, shown: 0 };
  // Another account is signed in: the stored account's reminders stay silent
  // until the user decides (lib/account/pending.ts).
  if (await readPending(store)) return { nextAt: null, shown: 0 };
  const [prefs, session, tasks, taskState, courses, notified, changes, calendar] = await Promise.all([
    readPrefs(store),
    readSession(store),
    readUser(store, userId, 'tasks'),
    readUser(store, userId, 'taskState'),
    readUser(store, userId, 'courses'),
    readUser(store, userId, 'notified'),
    readUser(store, userId, 'changes'),
    readCalendar(store),
  ]);

  const plan = planReminders({
    now,
    timeZone,
    // A personal due date (dashboard) gets the same reminders.
    tasks: applyPersonalDue(tasks, taskState).tasks,
    taskState,
    activeCourseIds: activeCourseIds(courses),
    settings: prefs.reminders,
    sent: notified,
    session: { state: session.state, expiredAt: session.expiredAt ?? null },
    changes,
    updates: prefs.updates,
    calendar: { events: calendar.kegiatan, settings: prefs.calendar, source: calendar.sumber.sk.replace(/^Keputusan Rektor/, 'SK Rektor') },
  });

  // The account captured at the start must still be active before every
  // write and every notification; after a switch the cycle stops silently.
  if (plan.markSent.length > 0 || plan.send.length > 0) {
    const recorded = { ...notified, ...Object.fromEntries(plan.markSent.map((k) => [k, now])) };
    if (!(await writeUserIfCurrent(store, userId, 'notified', pruneSent(recorded, now, new Set(tasks.map((t) => t.eventId)))))) {
      return { nextAt: null, shown: 0 };
    }
  }

  const m = messagesFor(resolveLocale(prefs.locale, deps.uiLanguage));
  const byId = new Map(courses.map((c) => [c.id, c]));
  const courseName = (t: Task) => {
    const c = byId.get(t.courseId);
    return c ? courseAlias(c) : '';
  };

  const courseNameById = (id: number | null) => {
    const c = id === null ? undefined : byId.get(id);
    return c ? courseAlias(c) : null;
  };

  let shown = 0;
  const shownKinds: Notice['kind'][] = [];
  for (const notice of plan.send) {
    if ((await currentUser(store)) !== userId) return { nextAt: null, shown, shownKinds };
    try {
      await deps.notifier.show(notificationId(notice), noticeView(notice, { now, timeZone, m, courseName, courseNameById }));
      shown += 1;
      shownKinds.push(notice.kind);
    } catch {
      const stats = await readUser(store, userId, 'stats');
      await writeUserIfCurrent(store, userId, 'stats', { ...stats, notifyFailures: stats.notifyFailures + 1, lastNotifyFailureAt: now });
    }
  }
  return { nextAt: plan.nextAt, shown, shownKinds };
}
