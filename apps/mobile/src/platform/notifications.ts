import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { channelFor, type ChannelPlan } from '@sulo/core/notify/channels';
import type { AlarmScheduler, Notifier, ScheduledAlarm } from '@sulo/core/platform';
import type { KeyValueStore } from '@sulo/core/types';
import { applyNotifyChannels } from '../notify-sound';

// Local notifications. Never exact alarms (no SCHEDULE_EXACT_ALARM): a
// reminder may come a few minutes late, which the plan accepts.

/**
 * Whether Android lets Sulo show notifications right now. It only reads the
 * answer. On Android 13 and later the plugin's schedule() asks the user for
 * the permission itself when it is missing; that question belongs to one
 * place, the "Izinkan pengingat" button of the onboarding's reminders step.
 * Everything else that would schedule or show a notification asks here first
 * and does nothing without permission. Unknown counts as "no".
 */
export async function notificationsAllowed(): Promise<boolean> {
  try {
    return (await LocalNotifications.checkPermissions()).display === 'granted';
  } catch {
    return false;
  }
}

/** Stable numeric ids for Android from Sulo's string ids. */
export function numericId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_000_000_000;
}

/**
 * The one door for the app's own notifications: every one is put on the
 * channel of its kind (core notify/channels.ts, from its Sulo id), after
 * the channels are made sure to match the chosen sound. Nothing else in the
 * app calls the plugin's schedule(), so no notification ends up on a
 * channel of its own. The caller has checked the permission; this never asks.
 */
export async function scheduleOnChannels(store: KeyValueStore, notifications: LocalNotificationSchema[]): Promise<void> {
  if (notifications.length === 0) return;
  const plan = await applyNotifyChannels(store);
  if (Capacitor.getPlatform() === 'ios') {
    // iOS has no channels: each notification carries its kind's sound (a CAF in the bundle, scripts/ios-sounds.mjs),
    // "default" for the phone's own, and none for the silent kinds (the plugin plays nothing without one).
    await LocalNotifications.schedule({ notifications: notifications.map((n) => ({ ...n, ...iosSound(plan, String(n.extra?.suloId ?? '')) })) });
    return;
  }
  await LocalNotifications.schedule({ notifications: notifications.map((n) => ({ ...n, channelId: channelFor(plan, String(n.extra?.suloId ?? '')) })) });
}

/** The sound of a notification on iOS, from the same channel plan Android follows. */
export function iosSound(plan: ChannelPlan, suloId: string): { sound?: string } {
  // "Sulo perlu disegarkan besok" (ios-refresh.ts) is always quiet.
  if (suloId.startsWith('refresh|')) return {};
  const spec = plan.channels.find((c) => c.id === channelFor(plan, suloId));
  if (!spec || spec.importance === 'low' || spec.sound === null) return {};
  return { sound: spec.sound === 'default' ? 'default' : `${spec.sound}.caf` };
}

export function createNotifier(store: KeyValueStore): Notifier {
  return {
    async show(id, view, options = {}) {
      if (!(await notificationsAllowed())) return;
      await scheduleOnChannels(store, [{ id: numericId(id), title: view.title, body: view.message, extra: { suloId: id }, isExactNotification: false, ...(options.silent ? { silent: true } : {}) }]);
    },
    async clear(id) {
      await LocalNotifications.cancel({ notifications: [{ id: numericId(id) }] });
      return true;
    },
    onClick(listener) {
      const handle = LocalNotifications.addListener('localNotificationActionPerformed', (e) => listener(String(e.notification.extra?.suloId ?? e.notification.id)));
      return () => void handle.then((h) => h.remove());
    },
  };
}

/**
 * Alarms are scheduled notifications on Android: no code runs at the alarm
 * time (from the latest data on the phone). A name maps to one pending
 * notification; the text is set by whoever schedules it (reminders.ts).
 */
export function createAlarmScheduler(store: KeyValueStore): AlarmScheduler {
  return {
    async schedule(name, when) {
      const at = when.at !== undefined ? when.at * 1000 : Date.now() + (when.delayMinutes ?? 1) * 60_000;
      if (!(await notificationsAllowed())) return;
      await scheduleOnChannels(store, [{ id: numericId(name), title: 'Sulo', body: '', extra: { suloId: name }, schedule: { at: new Date(at), allowWhileIdle: true }, isExactNotification: false }]);
    },
    async cancel(name) {
      await LocalNotifications.cancel({ notifications: [{ id: numericId(name) }] });
      return true;
    },
    async list(): Promise<ScheduledAlarm[]> {
      const { notifications } = await LocalNotifications.getPending();
      return notifications.map((n) => ({ name: String(n.extra?.suloId ?? n.id), at: Math.floor((n.schedule?.at ? new Date(n.schedule.at).getTime() : 0) / 1000), periodMinutes: null }));
    },
    onAlarm() {
      // Nothing runs at alarm time on mobile.
      return () => undefined;
    },
  };
}
