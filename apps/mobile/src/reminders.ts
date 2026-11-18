// Reminders on Android come from the data already on the phone: no sync
// happens in the background. After every sync (and at start), the core
// reminder cycle is played forward over the next days on a copy of the
// data, and what it would show is scheduled as local notifications. The
// planner's rules hold as in the extension (stages, quiet hours, calendar),
// minus the "session expired" notice, which mobile does not send.

import { runNotifyCycle } from '@sulo/core/reminders/run';
import type { NotificationView } from '@sulo/core/reminders/text';
import type { Platform } from '@sulo/core/platform';
import type { KeyValueStore, UnixSeconds } from '@sulo/core/types';
import { LocalNotifications } from '@capacitor/local-notifications';
import { numericId } from './platform/notifications';

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

export async function planReminders(store: KeyValueStore, now: UnixSeconds, timeZone: string, uiLanguage: string): Promise<PlannedReminder[]> {
  const sim = await copyStore(store);
  // Mobile never notifies about the session; sign-in has its own line in the app.
  await sim.set('global:session', { state: 'OK', userId: null, checkedAt: now });
  const out: PlannedReminder[] = [];
  const end = now + HORIZON_DAYS * 86_400;
  let at: UnixSeconds | null = now;
  for (let guard = 0; at !== null && at <= end && out.length < MAX_SCHEDULED && guard < 500; guard++) {
    const when: UnixSeconds = at;
    const result = await runNotifyCycle({ store: sim, now: when, timeZone, uiLanguage, notifier: { show: async (id, view) => void out.push({ at: when, id, view }) } });
    at = result.nextAt !== null && result.nextAt > when ? result.nextAt : null;
  }
  return out.slice(0, MAX_SCHEDULED);
}

/** Replaces the previously scheduled reminders with a fresh plan. */
export async function scheduleReminders(platform: Platform): Promise<number> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const planned = await planReminders(platform.store, platform.clock.now(), timeZone, navigator.language);
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
