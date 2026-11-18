// Syncs on Android. There is no background sync (sessions last about two
// hours after the last activity, and Sulo never keeps one alive). Every
// sync here is started by the user: opening the app, "Perbarui", or right
// after signing in. Those count as real activity, so SuloSession sends
// nosessionupdate=false for them; runSync keeps its own rules (2-minute
// cooldown for "manual", budget, queue, backoff).

import { createMoodleClient, type MoodleClient } from '@sulo/core/moodle/client';
import { refreshPresensiForCurrent, type PresensiOutcome } from '@sulo/core/presensi/service';
import { SIKOLA_ORIGIN } from '@sulo/core/moodle/limits';
import { writeSession, readSession } from '@sulo/core/moodle/session';
import { createSessionAgeLogger } from '@sulo/core/net/session-age';
import type { Platform } from '@sulo/core/platform';
import { readUser, currentUser } from '@sulo/core/storage';
import { runSync } from '@sulo/core/sync/run-sync';
import type { SyncOutcome, UnixSeconds } from '@sulo/core/types';
import { NATIVE_SESSKEY, createSessionHttp } from './platform/http';
import { recordTimeRemaining } from './dev-log';

/** Opening the app syncs when the data is older than this. */
export const RESUME_STALE_SEC = 15 * 60;

/** SIKOLA through SuloSession, with the core client's budget, queue and backoff. */
export function sikolaClient(platform: Platform, options: { userInitiated: boolean; dev?: boolean }): MoodleClient {
  const { store, clock } = platform;
  const http = createSessionHttp(options.userInitiated, (body) => void recordTimeRemaining(store, clock.now(), body));
  return createMoodleClient({
    fetch: http.request,
    store,
    clock,
    baseUrl: SIKOLA_ORIGIN,
    // The real sesskey never reaches JavaScript; SuloSession inserts it.
    getSesskey: async () => NATIVE_SESSKEY,
    noSessionUpdate: !options.userInitiated,
    sessionAge: options.dev ? createSessionAgeLogger(store) : undefined,
  });
}

export async function syncNow(platform: Platform, options: { userInitiated: boolean; dev?: boolean }): Promise<SyncOutcome> {
  // pnpm mobile:web: the demo account stays as it is (no request ever leaves the browser).
  if (__SULO_WEB_FAKE__ && import.meta.env.MODE === 'web') return { status: 'ok', at: platform.clock.now(), tasks: 0, courseListFetched: false };
  // Offline: nothing to try, the latest data stays.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { status: 'offline' };
  return runSync({ client: sikolaClient(platform, options), store: platform.store, clock: platform.clock, trigger: 'manual' });
}

/** Presensi's Perbarui or an opened view: always the user's own request. */
export function refreshPresensi(platform: Platform, target: 'recap' | 'detail', courseId: number | null, force: boolean): Promise<PresensiOutcome> {
  if (__SULO_WEB_FAKE__ && import.meta.env.MODE === 'web') return Promise.resolve({ status: 'fresh' });
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve({ status: 'failed', reason: 'offline' });
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return refreshPresensiForCurrent({ client: sikolaClient(platform, { userInitiated: true }), store: platform.store, clock: platform.clock, timeZone }, target, courseId, force);
}

/** After a successful sign-in: forget "expired" and fetch right away. */
export async function syncAfterLogin(platform: Platform, dev = false): Promise<SyncOutcome> {
  if (__SULO_WEB_FAKE__ && import.meta.env.MODE === 'web') {
    const { seedDemo } = await import('./fake/demo');
    await seedDemo(platform.store, platform.clock.now());
    return { status: 'ok', at: platform.clock.now(), tasks: 0, courseListFetched: false };
  }
  if ((await readSession(platform.store)).state === 'EXPIRED') await writeSession(platform.store, platform.clock, 'UNKNOWN');
  return syncNow(platform, { userInitiated: true, dev });
}

export async function lastSyncAt(platform: Platform): Promise<UnixSeconds | null> {
  const userId = await currentUser(platform.store);
  return userId === null ? null : ((await readUser(platform.store, userId, 'sync')).lastSyncAt ?? null);
}

/** Back in the foreground: sync only when the data is older than 15 minutes. */
export function resumeNeedsSync(last: UnixSeconds | null, now: UnixSeconds): boolean {
  return last === null || now - last >= RESUME_STALE_SEC;
}
