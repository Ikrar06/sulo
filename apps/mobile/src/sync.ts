// Syncs on Android started by the user: opening the app, "Perbarui", or
// right after signing in. Those count as real activity, so SuloSession sends
// nosessionupdate=false for them; runSync keeps its own rules (2-minute
// cooldown for "manual", budget, queue, backoff). A SIKOLA session ends after
// some hours without activity (measured up to about 8, docs/RISIKO.md);
// background checks happen only with "Pantau tugas baru" on (watch-native.ts).

import { createMoodleClient, type MoodleClient } from '@sulo/core/moodle/client';
import { refreshPresensiForCurrent, type PresensiOutcome } from '@sulo/core/presensi/service';
import { MANUAL_COOLDOWN_SEC, SIKOLA_ORIGIN } from '@sulo/core/moodle/limits';
import { writeSession, readSession } from '@sulo/core/moodle/session';
import { createSessionAgeLogger } from '@sulo/core/net/session-age';
import type { Platform } from '@sulo/core/platform';
import { readUser, currentUser } from '@sulo/core/storage';
import { runSync, type SyncDeps } from '@sulo/core/sync/run-sync';
import type { SyncOutcome, UnixSeconds } from '@sulo/core/types';
import { NATIVE_SESSKEY, createSessionHttp } from './platform/http';
import { SuloSession } from './session';
import { recordTimeRemaining } from './dev-log';
import { updateRequired } from './release';

/** Opening the app syncs when the data is older than this. */
export const RESUME_STALE_SEC = 15 * 60;

/** SIKOLA through SuloSession, with the core client's budget, queue and backoff. */
export function sikolaClient(platform: Platform, options: { userInitiated: boolean; dev?: boolean; dailyBudget?: number }): MoodleClient {
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
    ...(options.dailyBudget !== undefined ? { dailyBudget: options.dailyBudget } : {}),
    sessionAge: options.dev ? createSessionAgeLogger(store) : undefined,
    // One login answer is never enough: a second, separate ask after 2 to 5 seconds must agree.
    confirmLogin: { wait: () => new Promise((resolve) => setTimeout(resolve, confirmDelayMs())) },
    // Only then does the vault end the session (the one place that decides; native SuloSession.endSession).
    onSessionEnded: async (why) => void (await SuloSession.endSession({ reason: why })),
    // Below a required update (config.json mobile.release.minVersionCode) nothing leaves for SIKOLA.
    updateRequired: () => updateRequired(store, clock.now()),
  });
}

/** 2 to 5 seconds, so the second ask is a separate moment. */
export const confirmDelayMs = (random: () => number = Math.random): number => 2000 + Math.floor(random() * 3000);

export async function syncNow(platform: Platform, options: { userInitiated: boolean; dev?: boolean; onStage?: SyncDeps['onStage'] }): Promise<SyncOutcome> {
  // pnpm mobile:web: the demo account stays as it is (no request ever leaves the browser).
  if (__SULO_WEB_FAKE__ && import.meta.env.MODE === 'web') return fakeStages(platform, options.onStage);
  // Offline: nothing to try, the latest data stays.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { status: 'offline' };
  return runSync({ client: sikolaClient(platform, options), store: platform.store, clock: platform.clock, trigger: 'manual', onStage: options.onStage });
}

/** Presensi's Perbarui or an opened view: always the user's own request. */
export function refreshPresensi(platform: Platform, target: 'recap' | 'detail', courseId: number | null, force: boolean): Promise<PresensiOutcome> {
  // ?presensi=slow keeps it loading, for the skeleton's screenshot.
  if (__SULO_WEB_FAKE__ && import.meta.env.MODE === 'web') return new Promise((resolve) => setTimeout(() => resolve({ status: 'fresh' }), new URLSearchParams(location.search).get('presensi') === 'slow' ? 60_000 : 0));
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve({ status: 'failed', reason: 'offline' });
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return refreshPresensiForCurrent({ client: sikolaClient(platform, { userInitiated: true }), store: platform.store, clock: platform.clock, timeZone }, target, courseId, force);
}

/** After a successful sign-in: forget "expired" and fetch right away. */
export async function syncAfterLogin(platform: Platform, dev = false, onStage?: SyncDeps['onStage']): Promise<SyncOutcome> {
  if (__SULO_WEB_FAKE__ && import.meta.env.MODE === 'web') {
    const { seedDemo } = await import('./fake/demo');
    await seedDemo(platform.store, platform.clock.now());
    return fakeStages(platform, onStage);
  }
  if ((await readSession(platform.store)).state === 'EXPIRED') await writeSession(platform.store, platform.clock, 'UNKNOWN');
  return syncNow(platform, { userInitiated: true, dev, onStage });
}

export async function lastSyncAt(platform: Platform): Promise<UnixSeconds | null> {
  const userId = await currentUser(platform.store);
  return userId === null ? null : ((await readUser(platform.store, userId, 'sync')).lastSyncAt ?? null);
}

/**
 * Perbarui within core's 2-minute pause after a good sync (runSync answers
 * FRESH and sends nothing): the app says "Sudah terbaru" without a spinner.
 */
export async function manualFresh(platform: Platform): Promise<boolean> {
  const last = await lastSyncAt(platform);
  return last !== null && platform.clock.now() - last < MANUAL_COOLDOWN_SEC;
}

/** Back in the foreground: sync only when the data is older than 15 minutes. */
export function resumeNeedsSync(last: UnixSeconds | null, now: UnixSeconds): boolean {
  return last === null || now - last >= RESUME_STALE_SEC;
}

/**
 * pnpm mobile:web: the demo's stages at a believable pace (no request ever
 * leaves the browser). ?prep=fail fails the tasks, ?prep=partial the attendance.
 */
async function fakeStages(platform: Platform, onStage?: SyncDeps['onStage']): Promise<SyncOutcome> {
  const mode = new URLSearchParams(location.search).get('prep');
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await wait(500);
  if (mode === 'fail') {
    onStage?.('tasks', 'failed');
    return { status: 'server_error' };
  }
  onStage?.('tasks', 'ok');
  await wait(300);
  onStage?.('courses', 'ok');
  await wait(400);
  onStage?.('attendance', mode === 'partial' ? 'failed' : 'ok');
  return { status: 'ok', at: platform.clock.now(), tasks: 0, courseListFetched: false };
}
