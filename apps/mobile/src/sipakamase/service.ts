// Sipakamase on the phone (1.1.0): core's module, readers and keeper
// (sipakamase/run.ts) over the phone's adaptors. Requests go through core's
// scheduler (the `sipakamase` domain: GET, five exact paths) to
// SuloSipakamase.get, which adds the vault's cookie natively and refuses any
// other path again. Data keys "sipakamase:" live in their own encrypted store.
//
// The keeper here runs when the app is opened (keep(): one rotating GET when
// one is due); while the app is closed the background worker only keeps the
// session alive (Kotlin, no page content kept).

import { createScheduler } from '@sulo/core/net/scheduler';
import type { Platform, KeyValueStore } from '@sulo/core/platform';
import { readRemoteConfig } from '@sulo/core/remote/remote-config';
import { SIPAKAMASE_ORIGIN } from '@sulo/core/sipakamase/allowlist';
import { disableSipakamase, enableSipakamase, readSipakamaseModule, type ModuleDeps } from '@sulo/core/sipakamase/module';
import { idlePause, keep, refresh, type SipakamaseDeps } from '@sulo/core/sipakamase/run';
import { idleTooLong, markOpened } from '@sulo/core/watch/idle';
import { foldWorker, readKeeper, writeKeeper } from '@sulo/core/sipakamase/keeper';
import { readConnection, transition, writeConnection } from '@sulo/core/sipakamase/connection';
import { SIPAKAMASE_DATA_PREFIX } from '@sulo/core/sipakamase/store';
import { localParts } from '@sulo/core/reminders/zoned';
import { SuloNeosia } from '../neosia-native';
import { createEncryptedStore, createNeosiaStore } from '../platform/neosia-store';
import { SuloSipakamase } from '../sipakamase-native';
import { runMkpkNotices } from '@sulo/core/mkpk/notices-run';
import { resolveLocale } from '@sulo/core/i18n';
import { readPrefs } from '@sulo/core/prefs';

/** NEOSIA's and Sipakamase's encrypted keys over the app's store (the MKPK card reads both). */
export function sipakamaseStore(platform: Platform): KeyValueStore {
  return createEncryptedStore(createNeosiaStore(platform.store, SuloNeosia), SuloSipakamase, SIPAKAMASE_DATA_PREFIX);
}

const toLogin = () => new Response(null, { status: 303, headers: { Location: `${SIPAKAMASE_ORIGIN}/` } });

/** core's FetchLike for the sipakamase domain: the native GET, its answer as a Response. */
async function nativeFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = new URL(input);
  if (url.origin !== SIPAKAMASE_ORIGIN || (init?.method ?? 'GET') !== 'GET' || url.search || url.hash) return new Response('', { status: 404 });
  const reply = await SuloSipakamase.get({ path: url.pathname });
  if (reply.networkError) throw new TypeError('network');
  if (reply.noSession || reply.toLogin || reply.status === undefined) return toLogin();
  return new Response(reply.html ?? '', { status: reply.status, headers: { 'Content-Type': 'text/html' } });
}

export function sipakamaseDeps(platform: Platform): { run: SipakamaseDeps; module: ModuleDeps } {
  const store = sipakamaseStore(platform);
  const now = () => platform.clock.now();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const scheduler = createScheduler({ fetch: nativeFetch, store: platform.store, clock: platform.clock, random: Math.random });
  return {
    run: { store, scheduler, now, today: () => localParts(now(), timeZone).dateKey, config: () => readRemoteConfig(platform.store) },
    module: {
      store,
      now,
      // No browser permission on the phone; its sign-in screen carries no script.
      hasPermissions: async () => true,
      removePermissions: async () => undefined,
      scripting: () => null,
      forgetSession: () => SuloSipakamase.forget(),
    },
  };
}

export type ConnectResult = 'connected' | 'closed' | 'offline';

/** After consent: the module on, the sign-in screen, then the five fragments once (the user asked). */
export async function connectSipakamase(platform: Platform, words: { close: string; offline: string; retry: string }): Promise<ConnectResult> {
  const deps = sipakamaseDeps(platform);
  await enableSipakamase(deps.module, false);
  const signed = await SuloSipakamase.signIn(words);
  if (signed.result !== 'signed_in') return signed.result;
  await refresh(deps.run);
  return 'connected';
}

/** "Masuk lagi": the sign-in screen only, then a refresh. */
export async function signInAgain(platform: Platform, words: { close: string; offline: string; retry: string }): Promise<ConnectResult> {
  const signed = await SuloSipakamase.signIn(words);
  if (signed.result !== 'signed_in') return signed.result;
  await refresh(sipakamaseDeps(platform).run);
  return 'connected';
}

export const disconnectSipakamase = (platform: Platform) => disableSipakamase(sipakamaseDeps(platform).module);
export const refreshSipakamase = (platform: Platform) => refresh(sipakamaseDeps(platform).run);
/**
 * The background keeper's reads into the app's state: its count and time
 * into the keeper (one limit, one interval), and a login page it met into
 * the connection.
 */
export async function foldWorkerKeep(platform: Platform): Promise<void> {
  const deps = sipakamaseDeps(platform).run;
  if (!(await readSipakamaseModule(deps.store)).enabled) return;
  const worker = await SuloSipakamase.workerState().catch(() => null);
  if (!worker) return;
  await writeKeeper(deps.store, foldWorker(await readKeeper(deps.store), worker, deps.today()));
  const conn = await readConnection(deps.store, true);
  if (worker.loginAt > conn.since) {
    const next = transition(conn, { kind: 'login_page' }, worker.loginAt);
    if (next !== conn) await writeConnection(deps.store, next);
  }
}

/**
 * On opening the app: after 7 days or more without it (watch/idle.ts) the
 * connection rests and asks to connect again; otherwise the worker's reads
 * are folded in, then the keeper's rotating read runs when one is due.
 */
export const keepSipakamase = async (platform: Platform) => {
  const now = platform.clock.now();
  const previous = await markOpened(platform.store, now).catch(() => null);
  if (idleTooLong(previous, now)) return idlePause(sipakamaseDeps(platform).run).catch(() => undefined);
  return keepNow(platform);
};

const keepNow = (platform: Platform) =>
  foldWorkerKeep(platform)
    .then(() => keep(sipakamaseDeps(platform).run))
    .catch(() => undefined);

/** MKPK notifications (core mkpk/notices-run.ts) after a read or on opening the app; shown at once on the reminders channel. */
export async function notifyMkpk(platform: Platform): Promise<number> {
  const prefs = await readPrefs(platform.store);
  return runMkpkNotices({
    store: sipakamaseStore(platform),
    now: platform.clock.now(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: resolveLocale(prefs.locale, navigator.language),
    show: (id, title, body) => platform.notifier.show(id, { icon: 'idle', title, message: body, buttons: [] }),
  }).catch(() => 0);
}
