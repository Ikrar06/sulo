// The Android app's reads from Sulo's public data repository (ikrar06.github.io):
// the remote config (its mobile.backgroundKeepAlive switch) and the academic
// calendar. Through core's public fetcher: data only, validated, no cookie
// and nothing of Sulo's own in the request. At most once a day each, plus
// when the app is opened and the last read is over 6 hours old. A failed or
// broken read keeps the last stored value (core).

import { refreshCalendar } from '@sulo/core/calendar/remote';
import { isReadOnly } from './read-only';
import { CALENDAR_URL, REMOTE_CONFIG_URL } from '@sulo/core/moodle/limits';
import { createScheduler } from '@sulo/core/net/scheduler';
import type { Platform } from '@sulo/core/platform';
import { fetchSlotHour } from '@sulo/core/remote/fetch-public';
import { keepAliveFrom, type KeepAliveConfig } from '@sulo/core/remote/keep-alive';
import { readRemoteConfig, refreshRemoteConfig } from '@sulo/core/remote/remote-config';

/** Opening the app reads again once the last read is this old. */
export const OPENED_MIN_GAP_H = 6;

/** Reads what is due; `opened` when the app came to the foreground. Never throws. */
export async function refreshPublicData(platform: Platform, opened: boolean): Promise<void> {
  // pnpm mobile:web: nothing leaves the browser. "Lihat data terakhir": nothing leaves at all (read-only.ts).
  if ((__SULO_WEB_FAKE__ && import.meta.env.MODE === 'web') || isReadOnly()) return;
  const { store, clock } = platform;
  const scheduler = createScheduler({ fetch: (input, init) => fetch(input, { ...init, credentials: 'omit' }), store, clock, random: Math.random });
  const slot = await fetchSlotHour(store);
  const minGapHours = opened ? OPENED_MIN_GAP_H : undefined;
  await refreshRemoteConfig({ scheduler, store, clock, url: REMOTE_CONFIG_URL, fetchSlotHour: slot, minGapHours }).catch(() => undefined);
  await refreshCalendar({ scheduler, store, clock, url: CALENDAR_URL, fetchSlotHour: slot, minGapHours }).catch(() => 'failed');
}

/** The background-watching settings in force (last good config, else the defaults). */
export async function readKeepAlive(platform: Platform): Promise<KeepAliveConfig> {
  return keepAliveFrom(await readRemoteConfig(platform.store));
}
