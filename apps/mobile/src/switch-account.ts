// Another SIKOLA account signed in on this phone (M8c.2), as the extension
// does it (core account/pending.ts): the sync that sees the other userid
// writes nothing and leaves global:accountPending; the user then decides on
// one screen. Until then the previous account's data stays as it was,
// background watching is off, and no further request is made.
//
//   "Pakai akun ini": every key of the previous account (tasks, news,
//   attendance, done marks, notes, steps), its nickname, its scheduled
//   reminders and every pending notification, and the background watching
//   state (plan, queued answers, held notices, timings) are deleted; the
//   other account becomes current and the onboarding runs from screen 5.
//   General settings (theme, language, reminder times) stay.
//
//   "Batal": the session just signed in is thrown away (cookies, sesskey);
//   the previous account's data is untouched and shows with "Masuk lagi".

import { SuloNeosia } from './neosia-native';
import { disconnectSipakamase } from './sipakamase/service';
import { currentUser } from '@sulo/core/storage';
import { ACCOUNT_PENDING_KEY, readPending } from '@sulo/core/account/pending';
import type { Platform } from '@sulo/core/platform';
import { writePrefs } from '@sulo/core/prefs';
import { switchUser } from '@sulo/core/storage';
import type { SyncOutcome } from '@sulo/core/types';
import { LocalNotifications } from '@capacitor/local-notifications';
import { clearScheduledReminders } from './reminders';
import { SuloSession } from './session';

/** The confirmation is due: the sync saw another account, or one is still waiting from before the app was closed. */
export async function switchPending(platform: Platform, outcome?: SyncOutcome): Promise<boolean> {
  if (outcome?.status === 'account_mismatch') return true;
  return (await readPending(platform.store)) !== null;
}

/** While the question is open: no background check for anyone (the plan is written disabled). */
export async function holdWatching(): Promise<void> {
  await SuloSession.watchApply({ plan: JSON.stringify({ enabled: false }) }).catch(() => undefined);
}

/** "Pakai akun ini". Returns false when there was nothing waiting (the screen then just closes). */
export async function useOtherAccount(platform: Platform): Promise<boolean> {
  const pending = await readPending(platform.store);
  if (!pending) return false;
  // Notifications first, so nothing of the previous account can still show.
  await clearScheduledReminders(platform).catch(() => undefined);
  const { notifications } = await LocalNotifications.getPending().catch(() => ({ notifications: [] as { id: number }[] }));
  if (notifications.length > 0) await LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) }).catch(() => undefined);
  await SuloSession.watchReset().catch(() => undefined);
  // The previous account's NEOSIA data goes too (encrypted, its own file; M8d B2).
  const previous = await currentUser(platform.store);
  if (previous !== null) await SuloNeosia.wipe({ user: previous }).catch(() => undefined);
  // Sipakamase too: the new account's owner has not agreed to it (its session, its data, its module state).
  await disconnectSipakamase(platform).catch(() => undefined);
  // Every u:{previous}:* key goes; the other account becomes current, empty.
  await switchUser(platform.store, pending.userId);
  await writePrefs(platform.store, { nickname: '' });
  await platform.store.remove(ACCOUNT_PENDING_KEY);
  return true;
}

/** "Batal": the new session is dropped; the previous account's data stays and shows with "Masuk lagi". */
export async function keepPreviousAccount(platform: Platform): Promise<void> {
  await SuloSession.discardSession().catch(() => undefined);
  await platform.store.remove(ACCOUNT_PENDING_KEY);
}
