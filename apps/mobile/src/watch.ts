// "Pantau tugas baru" on the phone: the user's choice and what the screens
// show about it. A key of the app's own (not the shared prefs), so the
// extension is untouched. New installs turn it on during onboarding;
// installs from before it stay off until the user turns it on. The checks
// themselves (scheduling, the batch) are part B of M8c.3.

import type { Platform } from '@sulo/core/platform';
import type { CheckTiming } from '@sulo/core/watch/sleep-help';

export const WATCH_KEY = 'mobile:watch';

export interface WatchState {
  /** The user's switch. In force only while the remote config allows it. */
  enabled: boolean;
  /** The app-lock offer is made once, the first time watching is turned on. */
  lockOffered: boolean;
  /** The last finished background check (unix seconds), for "Cek terakhir". */
  lastCheckAt: number | null;
  /** Recent checks' timing, for the "phone puts Sulo to sleep" help. */
  recent: CheckTiming[];
  /** The sleep help was closed; it shows once. */
  sleepHelpDismissed: boolean;
}

export const DEFAULT_WATCH: WatchState = { enabled: false, lockOffered: false, lastCheckAt: null, recent: [], sleepHelpDismissed: false };

export async function readWatch(platform: Platform): Promise<WatchState> {
  return { ...DEFAULT_WATCH, ...((await platform.store.get<Partial<WatchState>>(WATCH_KEY)) ?? {}) };
}

export async function updateWatch(platform: Platform, patch: Partial<WatchState>): Promise<WatchState> {
  const next = { ...(await readWatch(platform)), ...patch };
  await platform.store.set(WATCH_KEY, next);
  return next;
}
