import { LocalNotifications } from '@capacitor/local-notifications';
import type { AlarmScheduler, Notifier, ScheduledAlarm } from '@sulo/core/platform';

// Local notifications. Never exact alarms (no SCHEDULE_EXACT_ALARM): a
// reminder may come a few minutes late, which the plan accepts.

/** Stable numeric ids for Android from Sulo's string ids. */
export function numericId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_000_000_000;
}

export function createNotifier(): Notifier {
  return {
    async show(id, view, options = {}) {
      await LocalNotifications.schedule({
        notifications: [{ id: numericId(id), title: view.title, body: view.message, extra: { suloId: id }, isExactNotification: false, ...(options.silent ? { silent: true } : {}) }],
      });
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
 * time (no background sync on mobile). A name maps to one pending
 * notification; the text is set by whoever schedules it (reminders.ts).
 */
export function createAlarmScheduler(): AlarmScheduler {
  return {
    async schedule(name, when) {
      const at = when.at !== undefined ? when.at * 1000 : Date.now() + (when.delayMinutes ?? 1) * 60_000;
      await LocalNotifications.schedule({ notifications: [{ id: numericId(name), title: 'Sulo', body: '', extra: { suloId: name }, schedule: { at: new Date(at), allowWhileIdle: true }, isExactNotification: false }] });
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
