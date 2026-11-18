// Signing out of the app, and the optional app lock's setting.
import type { Platform } from '@sulo/core/platform';
import { clearScheduledReminders } from './reminders';
import { SuloSession } from './session';

/** The app lock is off by default; this key holds the user's choice. */
export const LOCK_KEY = 'mobile:lockEnabled';

/** "Keluar dan hapus data": the native session and its Keystore key, every Sulo key here, every scheduled reminder. */
export async function signOutEverything(platform: Platform): Promise<void> {
  await SuloSession.logout();
  await clearScheduledReminders(platform).catch(() => undefined);
  await platform.store.remove(await platform.store.keys(''));
  // Anything else still pending (a test notification, an old plan).
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
}
