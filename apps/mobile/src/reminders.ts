// Reminders on Android come from the data already on the phone (with
// background watching on, the worker's answers are read into it first). After every sync (and at start), the core
// reminder cycle is played forward over the next days on a copy of the
// data, and what it would show is scheduled as local notifications. The
// planner's rules hold as in the extension (stages, quiet hours, calendar),
// with the session notice estimated locally while watching is off.

import { runNotifyCycle } from '@sulo/core/reminders/run';
import type { NotificationView } from '@sulo/core/reminders/text';
import { readPending } from '@sulo/core/account/pending';
import type { Platform } from '@sulo/core/platform';
import type { KeyValueStore, UnixSeconds } from '@sulo/core/types';
import { LocalNotifications } from '@capacitor/local-notifications';
import { numericId } from './platform/notifications';
import { currentUser, readUser } from '@sulo/core/storage';
import { readRemoteConfig } from '@sulo/core/remote/remote-config';
import { keepAliveFrom } from '@sulo/core/remote/keep-alive';
import { WATCH_KEY } from './watch';

export const HORIZON_DAYS = 7;
/** Android keeps a few hundred alarms per app; Sulo stays far below. */
export const MAX_SCHEDULED = 48;
export const SCHEDULED_KEY = 'mobile:scheduledReminders';

export interface PlannedReminder {
  at: UnixSeconds;
  id: string;
  view: NotificationView;
}

/** An in-memory copy of the store, so playing the plan forward changes nothing real. */
export async function copyStore(store: KeyValueStore): Promise<KeyValueStore> {
  const data = new Map<string, unknown>();
  for (const key of await store.keys('')) data.set(key, structuredClone(await store.get(key)));
  return {
    get: async <T,>(k: string) => data.get(k) as T | undefined,
    set: async (k, v) => void data.set(k, structuredClone(v)),
    remove: async (keys) => void (Array.isArray(keys) ? keys : [keys]).forEach((k) => data.delete(k)),
    keys: async (prefix) => [...data.keys()].filter((k) => k.startsWith(prefix)),
  };
}

/** A SIKOLA session ends about this long after the last activity (the phone's own estimate, no request). */
export const SESSION_ESTIMATE_SEC = 2 * 3600;

/**
 * The session as the reminders see it. Watching on: always fine here, since
 * the worker itself sends one "Masuk lagi" when a check finds the session
 * ended. Watching off: no background request, so the end is estimated from
 * the last sync (activity + 2 hours); core's rules then send it only once
 * the data is over 24 hours old, at most once per 24 hours, never in quiet
 * hours. No sync yet: nothing to say.
 */
export async function sessionForReminders(store: KeyValueStore, now: UnixSeconds): Promise<{ state: 'OK' | 'EXPIRED'; userId: number | null; checkedAt: UnixSeconds; expiredAt?: UnixSeconds }> {
  const userId = await currentUser(store);
  const watch = (await store.get<{ enabled?: boolean }>(WATCH_KEY)) ?? {};
  const config = await readRemoteConfig(store);
  const watching = watch.enabled === true && config.enabled && keepAliveFrom(config).enabled;
  const last = userId === null ? null : (await readUser(store, userId, 'sync')).lastSyncAt;
  if (watching || last === null) return { state: 'OK', userId, checkedAt: now };
  return { state: 'EXPIRED', userId, checkedAt: now, expiredAt: last + SESSION_ESTIMATE_SEC };
}

export async function planReminders(store: KeyValueStore, now: UnixSeconds, timeZone: string, uiLanguage: string): Promise<PlannedReminder[]> {
  const sim = await copyStore(store);
  await sim.set('global:session', await sessionForReminders(store, now));
  const out: PlannedReminder[] = [];
  const end = now + HORIZON_DAYS * 86_400;
  let at: UnixSeconds | null = now;
  for (let guard = 0; at !== null && at <= end && out.length < MAX_SCHEDULED && guard < 500; guard++) {
    const when: UnixSeconds = at;
    // The phone's morning summary is the full one: overdue, today, tomorrow, today's events (reminders/morning.ts).
    const result = await runNotifyCycle({ store: sim, now: when, timeZone, uiLanguage, morningStyle: 'full', notifier: { show: async (id, view) => void out.push({ at: when, id, view }) } });
    at = result.nextAt !== null && result.nextAt > when ? result.nextAt : null;
  }
  return out.slice(0, MAX_SCHEDULED);
}

/** Replaces the previously scheduled reminders with a fresh plan. */
export async function scheduleReminders(platform: Platform): Promise<number> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // Another account is waiting for the user's answer: the previous account's reminders are cancelled, none planned (as the extension does).
  const planned = (await readPending(platform.store)) !== null ? [] : await planReminders(platform.store, platform.clock.now(), timeZone, navigator.language);
  const previous = (await platform.store.get<number[]>(SCHEDULED_KEY)) ?? [];
  if (previous.length > 0) await LocalNotifications.cancel({ notifications: previous.map((id) => ({ id })) });
  const notifications = planned.map((p) => ({
    id: numericId(p.id),
    title: p.view.title,
    body: p.view.message,
    extra: { suloId: p.id },
    // Due now (missed while the app was closed): a moment from now.
    schedule: { at: new Date(Math.max(p.at * 1000, Date.now() + 5_000)), allowWhileIdle: true },
    isExactNotification: false,
  }));
  if (notifications.length > 0) await LocalNotifications.schedule({ notifications });
  await platform.store.set(SCHEDULED_KEY, notifications.map((n) => n.id));
  return notifications.length;
}

/** Cancels every reminder Sulo scheduled (sign-out, account switch). */
export async function clearScheduledReminders(platform: Platform): Promise<void> {
  const previous = (await platform.store.get<number[]>(SCHEDULED_KEY)) ?? [];
  if (previous.length > 0) await LocalNotifications.cancel({ notifications: previous.map((id) => ({ id })) });
  await platform.store.remove(SCHEDULED_KEY);
}
