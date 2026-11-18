// Syncs on Android. There is no background sync (sessions last about two
// hours after the last activity, and Sulo never keeps one alive). Every
// sync here is started by the user: opening the app, "Perbarui", or right
// after signing in. Those count as real activity, so SuloSession sends
// nosessionupdate=false for them; runSync keeps its own rules (2-minute
// cooldown for "manual", budget, queue, backoff).

import { createMoodleClient } from '@sulo/core/moodle/client';
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

export async function syncNow(platform: Platform, options: { userInitiated: boolean; dev?: boolean }): Promise<SyncOutcome> {
  const { store, clock } = platform;
  const http = createSessionHttp(options.userInitiated, (body) => void recordTimeRemaining(store, clock.now(), body));
  const client = createMoodleClient({
    fetch: http.request,
    store,
    clock,
    baseUrl: SIKOLA_ORIGIN,
    // The real sesskey never reaches JavaScript; SuloSession inserts it.
    getSesskey: async () => NATIVE_SESSKEY,
    noSessionUpdate: !options.userInitiated,
    sessionAge: options.dev ? createSessionAgeLogger(store) : undefined,
  });
  return runSync({ client, store, clock, trigger: 'manual' });
}

/** After a successful sign-in: forget "expired" and fetch right away. */
export async function syncAfterLogin(platform: Platform, dev = false): Promise<SyncOutcome> {
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
