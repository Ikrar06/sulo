import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createScheduler } from '@sulo/core/net/scheduler';
import { remoteConfigSchema } from '@sulo/core/remote/remote-config';
import { DEFAULT_SOURCES, parseSources, sourcesFrom } from '@sulo/core/remote/sources';
import { SIPAKAMASE_ORIGIN } from '@sulo/core/sipakamase/allowlist';
import { CONNECTION_KEY, OFF, transition, type Connection } from '@sulo/core/sipakamase/connection';
import { afterAuto, KEEP_ORDER, KEEPER, planKeeper, planRefresh, START } from '@sulo/core/sipakamase/keeper';
import { disableSipakamase, enableSipakamase, readSipakamaseModule, reconcileSipakamase, READER_MATCHES, SIPAKAMASE_MODULE_KEY, type ModuleDeps, type ReaderScript } from '@sulo/core/sipakamase/module';
import { keep, passive, refresh, type SipakamaseDeps } from '@sulo/core/sipakamase/run';
import { readPage } from '@sulo/core/sipakamase/reader';
import { parsePassive, PASSIVE_MESSAGE_TYPE } from '@sulo/core/sipakamase/schema';
import { activities, applyFragment, EMPTY_DATA, FRAGMENT_PATH, hasPending, SIPAKAMASE_DATA_KEY, type SipakamaseData } from '@sulo/core/sipakamase/store';
import type { RemoteConfig } from '@sulo/core/types';
import { fakeFetch, fixedClock, memoryStore } from './helpers';

const fx = (name: string) => readFileSync(new URL(`../fixtures/synthetic/sipakamase/${name}.html`, import.meta.url), 'utf8');
const NOW = 1_794_000_000;
const H = 3600;
const PAGES: Record<string, string> = {
  [FRAGMENT_PATH.running]: fx('kegiatan'),
  [FRAGMENT_PATH.history]: fx('riwayat'),
  [FRAGMENT_PATH.courses]: fx('matakuliah'),
  [FRAGMENT_PATH.claim]: fx('klaim'),
  [FRAGMENT_PATH.conversions]: fx('rekappoin'),
};
const LOGIN = '<form><input name="username"><input type="password" name="password"></form>';

function setup(opts: { answer?: (path: string) => Response; config?: Partial<RemoteConfig>; on?: boolean } = {}) {
  const store = memoryStore(opts.on === false ? {} : { [SIPAKAMASE_MODULE_KEY]: { enabled: true, changedAt: 1 } });
  let now = NOW;
  const clock = { ...fixedClock('2026-11-26', 10, NOW), now: () => now };
  const fetch = fakeFetch(({ url }) => (opts.answer ? opts.answer(new URL(url).pathname) : new Response(PAGES[new URL(url).pathname] ?? '', { status: 200 })));
  const scheduler = createScheduler({ fetch, store, clock });
  const transitions: [string, string][] = [];
  const deps: SipakamaseDeps = {
    store,
    scheduler,
    now: () => now,
    today: () => (now - NOW < 14 * H ? '2026-11-26' : '2026-11-27'),
    config: async () => ({ enabled: true, minIntervalMinutes: 180, message: '', fetchedAt: 0, ...opts.config }),
    onTransition: (a, b) => void transitions.push([a.state, b.state]),
  };
  return { store, fetch, deps, transitions, advance: (sec: number) => (now += sec), paths: () => fetch.calls.map((c) => new URL(c.url).pathname) };
}

const conn = (state: Connection['state']): Connection => ({ state, since: 0, cause: null });

describe('connection states', () => {
  it('goes from off to waiting for a sign-in to live, and rests when nothing is waited for', () => {
    let c = transition(OFF, { kind: 'connect' }, 1);
    expect(c.state).toBe('needs_login');
    c = transition(c, { kind: 'read_ok', pending: true }, 2);
    expect(c).toEqual({ state: 'live', since: 2, cause: 'read_ok' });
    expect(transition(c, { kind: 'read_ok', pending: false }, 3).state).toBe('resting');
    expect(transition(conn('resting'), { kind: 'read_ok', pending: true }, 3).state).toBe('live');
  });

  it('believes one login page, and a changed page is broken, not signed out', () => {
    expect(transition(conn('live'), { kind: 'login_page' }, 1).state).toBe('needs_login');
    expect(transition(conn('resting'), { kind: 'login_page' }, 1).state).toBe('needs_login');
    expect(transition(conn('live'), { kind: 'read_shape' }, 1).state).toBe('broken');
    expect(transition(conn('broken'), { kind: 'read_ok', pending: true }, 1).state).toBe('live');
  });

  it('pauses for the owner and comes back to where it was', () => {
    const paused = transition(conn('resting'), { kind: 'remote_off' }, 1);
    expect(paused).toMatchObject({ state: 'paused_remote', beforeRemote: 'resting' });
    expect(transition(paused, { kind: 'read_ok', pending: true }, 2)).toBe(paused);
    expect(transition(paused, { kind: 'remote_on' }, 2).state).toBe('resting');
  });

  it('after 7 days unopened only Hubungkan lagi brings it back, and Putuskan always ends it', () => {
    const idle = transition(conn('live'), { kind: 'idle_days' }, 1);
    expect(idle.state).toBe('paused_idle');
    expect(transition(idle, { kind: 'read_ok', pending: true }, 2)).toBe(idle);
    expect(transition(idle, { kind: 'connect' }, 2).state).toBe('needs_login');
    for (const s of ['live', 'resting', 'broken', 'paused_idle', 'paused_remote', 'needs_login'] as const) expect(transition(conn(s), { kind: 'disconnect' }, 9).state).toBe('off');
    expect(transition(OFF, { kind: 'read_ok', pending: true }, 1)).toBe(OFF);
  });
});

describe('what is waited for', () => {
  const withParts = (parts: SipakamaseData['parts']): SipakamaseData => ({ ...EMPTY_DATA, parts });
  const activity = (status: 'planned' | 'done' | 'finished' | 'unknown') => ({ semester: 'x', basis: 'kompetisi' as const, kind: 'k', name: 'n', status, statusText: 's', hasCompanion: true, hasScore: false });

  it('is unknown, so waited for, until both the activities and the claim page were read', () => {
    expect(hasPending(EMPTY_DATA)).toBe(true);
    expect(hasPending(withParts({ running: [] }))).toBe(true);
  });

  it('counts an unfinished or unknown activity, and a passed course not yet in NEOSIA', () => {
    const claimDone = { passed: [{ code: null, name: 'a', sks: 2, inNeosia: true }], programmed: [] };
    expect(hasPending(withParts({ running: [activity('finished')], claim: claimDone }))).toBe(false);
    expect(hasPending(withParts({ running: [activity('done')], claim: claimDone }))).toBe(true);
    expect(hasPending(withParts({ running: [activity('unknown')], claim: claimDone }))).toBe(true);
    expect(hasPending(withParts({ running: [], claim: { passed: [{ code: null, name: 'a', sks: 2, inNeosia: null }], programmed: [] } }))).toBe(true);
  });

  it('matches each activity with its credits by name, and replaces one fragment at a time', () => {
    const a = applyFragment(EMPTY_DATA, { fragment: 'conversions', data: [{ name: 'Lomba  Esai', sksTotal: 0.58, sksUnconverted: 0.5 }] }, 10);
    const b = applyFragment(a, { fragment: 'running', data: [{ ...activity('done'), name: 'lomba esai' }] }, 20);
    expect(activities(b)[0]).toMatchObject({ stage: 'running', sksTotal: 0.58, sksUnconverted: 0.5 });
    expect(b.readAt).toEqual({ conversions: 10, running: 20 });
    expect(applyFragment(b, { fragment: 'running', data: [{ ...activity('done'), name: 'lomba esai' }] }, 30).changedAt.running).toBe(20);
  });
});

describe('the keeper', () => {
  const cfg = DEFAULT_SOURCES.sipakamase;

  it('reads one fragment every 3 hours in turn, only while live or broken', () => {
    expect(planKeeper(START, 'live', cfg, NOW, 'd')).toEqual({ due: true, fragment: 'running' });
    const after = afterAuto(START, NOW, 'd');
    expect(planKeeper(after, 'live', cfg, NOW + 2 * H, 'd')).toEqual({ due: false, reason: 'not_yet' });
    expect(planKeeper(after, 'live', cfg, NOW + 3 * H - 60, 'd')).toEqual({ due: true, fragment: 'history' });
    for (const s of ['resting', 'needs_login', 'off', 'paused_idle', 'paused_remote'] as const) expect(planKeeper(START, s, cfg, NOW, 'd')).toMatchObject({ due: false, reason: 'not_waiting' });
    expect(planKeeper(START, 'broken', cfg, NOW, 'd').due).toBe(true);
  });

  it('stops at 10 a day, and when the owner turns it off or slows it down', () => {
    expect(planKeeper({ ...START, autoDate: 'd', autoCount: KEEPER.dailyMax }, 'live', cfg, NOW, 'd')).toMatchObject({ reason: 'daily_max' });
    expect(planKeeper({ ...START, autoDate: 'd', autoCount: KEEPER.dailyMax }, 'live', cfg, NOW, 'e').due).toBe(true);
    expect(planKeeper(START, 'live', { ...cfg, keep: false }, NOW, 'd')).toMatchObject({ reason: 'keep_off' });
    expect(planKeeper(START, 'live', { ...cfg, enabled: false }, NOW, 'd')).toMatchObject({ reason: 'source_off' });
    const slow = { ...cfg, keepIntervalMinutes: 360 };
    expect(planKeeper(afterAuto(START, NOW, 'd'), 'live', slow, NOW + 4 * H, 'd')).toMatchObject({ reason: 'not_yet' });
    expect(KEEP_ORDER).toHaveLength(5);
  });

  it('lets "Perbarui sekarang" run once every 2 minutes', () => {
    expect(planRefresh(START, NOW)).toMatchObject({ allowed: true });
    expect(planRefresh({ ...START, lastRefreshAt: NOW }, NOW + 60)).toEqual({ allowed: false, retryAt: NOW + 120 });
  });
});

describe('reading Sipakamase', () => {
  it('Perbarui sekarang reads the five fragments in order and settles the connection', async () => {
    const { deps, store, paths } = setup();
    const r = await refresh(deps);
    expect(r).toMatchObject({ kind: 'done', read: 5, stoppedBy: null });
    expect(paths()).toEqual(Object.values(FRAGMENT_PATH));
    // The fixtures have an activity in progress: live, and the keeper keeps going.
    expect(store.dump()[CONNECTION_KEY]).toMatchObject({ state: 'live' });
    expect(Object.keys((store.dump()[SIPAKAMASE_DATA_KEY] as SipakamaseData).parts)).toHaveLength(5);
    expect(await refresh(deps)).toMatchObject({ kind: 'wait' });
  });

  it('stops at the first login page, without trying again', async () => {
    const { deps, store, paths } = setup({ answer: (p) => new Response(p === FRAGMENT_PATH.history ? LOGIN : PAGES[p], { status: 200 }) });
    expect(await refresh(deps)).toMatchObject({ kind: 'done', read: 1, stoppedBy: 'login' });
    expect(paths()).toHaveLength(2);
    expect(store.dump()[CONNECTION_KEY]).toMatchObject({ state: 'needs_login' });
  });

  it('treats a redirect as signed out and never follows it', async () => {
    const { deps, store, fetch } = setup({ answer: () => new Response(null, { status: 302, headers: { location: `${SIPAKAMASE_ORIGIN}/` } }) });
    await store.set(CONNECTION_KEY, { state: 'live', since: 1, cause: 'read_ok' });
    expect(await refresh(deps)).toMatchObject({ stoppedBy: 'login' });
    expect(fetch.calls).toHaveLength(1);
    expect(fetch.calls[0]!.init).toMatchObject({ redirect: 'manual' });
    expect(store.dump()[CONNECTION_KEY]).toMatchObject({ state: 'needs_login' });
  });

  it('a changed page keeps the old data and marks it broken', async () => {
    const { deps, store } = setup();
    await refresh(deps);
    const before = store.dump()[SIPAKAMASE_DATA_KEY];
    const changed = setup({ answer: () => new Response('<table><tr><th>Lain</th></tr></table>', { status: 200 }) });
    await changed.store.set(SIPAKAMASE_DATA_KEY, before);
    await changed.store.set(CONNECTION_KEY, { state: 'live', since: 1, cause: 'read_ok' });
    expect(await refresh(changed.deps)).toMatchObject({ stoppedBy: 'shape' });
    expect(changed.store.dump()[SIPAKAMASE_DATA_KEY]).toEqual(before);
    expect(changed.store.dump()[CONNECTION_KEY]).toMatchObject({ state: 'broken' });
  });

  it('the keeper sends one GET, the next fragment each time, and nothing while resting', async () => {
    const { deps, store, paths, advance } = setup();
    await store.set(CONNECTION_KEY, { state: 'live', since: 1, cause: 'read_ok' });
    expect(await keep(deps)).toEqual({ sent: true, read: 'ok' });
    expect(await keep(deps)).toEqual({ sent: false, reason: 'not_yet' });
    advance(3 * H);
    await keep(deps);
    expect(paths()).toEqual([FRAGMENT_PATH.running, FRAGMENT_PATH.history]);
    await store.set(CONNECTION_KEY, { state: 'resting', since: 1, cause: 'read_ok' });
    advance(3 * H);
    expect(await keep(deps)).toEqual({ sent: false, reason: 'not_waiting' });
    expect(paths()).toHaveLength(2);
  });

  it('sends nothing while the module is off or the owner stopped the source', async () => {
    const off = setup({ on: false });
    expect(await keep(off.deps)).toEqual({ sent: false, reason: 'off' });
    expect(await refresh(off.deps)).toEqual({ kind: 'off' });
    const stopped = setup({ config: { sources: { sipakamase: { enabled: false } } } });
    await stopped.store.set(CONNECTION_KEY, { state: 'live', since: 1, cause: 'read_ok' });
    expect(await refresh(stopped.deps)).toEqual({ kind: 'paused' });
    expect(await keep(stopped.deps)).toMatchObject({ sent: false });
    expect(stopped.store.dump()[CONNECTION_KEY]).toMatchObject({ state: 'paused_remote', beforeRemote: 'live' });
    const global = setup({ config: { enabled: false } });
    expect(await refresh(global.deps)).toEqual({ kind: 'paused' });
    expect(off.fetch.calls.length + stopped.fetch.calls.length + global.fetch.calls.length).toBe(0);
  });
});

describe('the passive reader', () => {
  it('stores a valid message and signs the connection in, without a request', async () => {
    const { deps, store, fetch } = setup();
    const data = [{ name: 'Lomba', sksTotal: 1, sksUnconverted: 1 }];
    expect(await passive(deps, parsePassive({ type: PASSIVE_MESSAGE_TYPE, fragment: 'conversions', data }))).toBe('stored');
    expect(store.dump()[CONNECTION_KEY]).toMatchObject({ state: 'live' });
    expect(fetch.calls).toHaveLength(0);
    expect(await passive(deps, parsePassive({ type: `${PASSIVE_MESSAGE_TYPE}:login` }))).toBe('login');
    expect(store.dump()[CONNECTION_KEY]).toMatchObject({ state: 'needs_login' });
  });

  it('refuses anything a page could slip in: extra fields, addresses, too long, unknown fragments', () => {
    const msg = (fragment: string, data: unknown, extra: Record<string, unknown> = {}) => parsePassive({ type: PASSIVE_MESSAGE_TYPE, fragment, data, ...extra });
    expect(msg('conversions', [{ name: 'x', sksTotal: 1, sksUnconverted: 1, url: '/ckonversimhs/sksmk/a' }]).kind).toBe('invalid');
    expect(msg('conversions', [{ name: 'x'.repeat(161), sksTotal: 1, sksUnconverted: 1 }]).kind).toBe('invalid');
    expect(msg('home', []).kind).toBe('invalid');
    expect(msg('conversions', [], { href: 'x' }).kind).toBe('invalid');
    expect(msg('claim', { passed: [{ code: '23U02130202', name: 'a', sks: 2, inNeosia: true, grade: 90 }], programmed: [] }).kind).toBe('invalid');
    expect(parsePassive('x').kind).toBe('invalid');
  });

  it('is ignored while the module is off or paused', async () => {
    const off = setup({ on: false });
    expect(await passive(off.deps, parsePassive({ type: PASSIVE_MESSAGE_TYPE, fragment: 'conversions', data: [] }))).toBe('ignored');
    expect(off.store.dump()[SIPAKAMASE_DATA_KEY]).toBeUndefined();
  });
});

describe('module life cycle', () => {
  function deps(granted = true) {
    const store = memoryStore();
    const registered: ReaderScript[] = [];
    let has = granted;
    const d: ModuleDeps = {
      store,
      now: () => 50,
      hasPermissions: async () => has,
      removePermissions: async () => void (has = false),
      scripting: () => ({
        registerContentScripts: async (s) => void registered.push(...s),
        unregisterContentScripts: async () => void registered.splice(0),
        getRegisteredContentScripts: async () => registered.map((s) => ({ id: s.id })),
      }),
    };
    return { d, store, registered, revoke: () => (has = false) };
  }

  it('turns on only with the permissions, registers the reader outside the login and home pages, and waits for a sign-in', async () => {
    expect(await enableSipakamase(deps(false).d, true)).toBe('no_permission');
    const { d, store, registered } = deps();
    expect(await enableSipakamase(d, true)).toBe('enabled');
    expect(registered).toHaveLength(1);
    expect(registered[0]!.world).toBe('ISOLATED');
    expect(READER_MATCHES.some((m) => /\/home|\/login|\/\*$/.test(m))).toBe(false);
    expect(store.dump()[CONNECTION_KEY]).toMatchObject({ state: 'needs_login' });
  });

  it('off removes the script, the permissions and every Sipakamase key', async () => {
    const { d, store, registered } = deps();
    await enableSipakamase(d, true);
    await store.set(SIPAKAMASE_DATA_KEY, EMPTY_DATA);
    await disableSipakamase(d);
    expect(registered).toHaveLength(0);
    expect(await d.hasPermissions()).toBe(false);
    expect(Object.keys(store.dump()).filter((k) => k.startsWith('sipakamase:'))).toEqual([]);
    expect(await readSipakamaseModule(store)).toEqual({ enabled: false, changedAt: 50 });
  });

  it('a permission taken away in the browser turns it off and deletes the data', async () => {
    const { d, store, revoke } = deps();
    await enableSipakamase(d, true);
    await store.set(SIPAKAMASE_DATA_KEY, EMPTY_DATA);
    revoke();
    expect(await reconcileSipakamase(d, true)).toBe('turned_off');
    expect(store.dump()[SIPAKAMASE_DATA_KEY]).toBeUndefined();
  });
});

describe('sources in the config', () => {
  it('reads each field on its own, never faster than 3 hours, and the global switch stops it', () => {
    expect(parseSources(undefined)).toEqual(DEFAULT_SOURCES);
    expect(parseSources({ sipakamase: { keepIntervalMinutes: 60 } }).sipakamase.keepIntervalMinutes).toBe(180);
    expect(parseSources({ sipakamase: { keepIntervalMinutes: 360, keep: false } }).sipakamase).toEqual({ enabled: true, keep: false, keepIntervalMinutes: 360 });
    expect(sourcesFrom({ enabled: false, minIntervalMinutes: 180, message: '', fetchedAt: 0 }).sipakamase).toMatchObject({ enabled: false, keep: false });
  });

  it('refuses a file whose source switch is broken', () => {
    const base = { enabled: true, minIntervalMinutes: 180, message: '' };
    expect(remoteConfigSchema.safeParse({ ...base, sources: { sipakamase: { keep: 'no' } } }).success).toBe(false);
    expect(remoteConfigSchema.safeParse({ ...base, sources: { neosia: 1 } }).success).toBe(false);
    expect(remoteConfigSchema.safeParse({ ...base, sources: { sipakamase: { keep: false } } }).success).toBe(true);
  });
});

describe('the reader on a page', () => {
  const page = `<header><span>Nama Mahasiswa Sintetis</span> <span>contoh@student.example</span></header><div id="main_content">${fx('klaim')}</div>`;

  it('sends each fragment it recognises once, projected, with nothing from the rest of the page', () => {
    const out: unknown[] = [];
    const sent = new Map();
    const deps = { html: () => page, asksPassword: () => false, send: (m: unknown) => void out.push(m) };
    expect(readPage(deps, sent)).toBe(1);
    expect(readPage(deps, sent)).toBe(0);
    expect(out).toHaveLength(1);
    expect(parsePassive(out[0]).kind).toBe('value');
    const text = JSON.stringify(out);
    for (const leak of ['Nama Mahasiswa', 'student.example', '90.00', 'hx-get', 'Klaim Nilai']) expect(text).not.toContain(leak);
  });

  it('on a page asking for a password reads nothing and says so once', () => {
    const out: unknown[] = [];
    const sent = new Map();
    const deps = { html: () => page, asksPassword: () => true, send: (m: unknown) => void out.push(m) };
    readPage(deps, sent);
    readPage(deps, sent);
    expect(out).toEqual([{ type: `${PASSIVE_MESSAGE_TYPE}:login` }]);
  });
});

describe('the phone worker and the app share one keeper', () => {
  it('folds the worker reads into the count and the interval, once each', async () => {
    const { foldWorker, ownReadsToday } = await import('@sulo/core/sipakamase/keeper');
    const mine = { ...START, autoDate: 'd', autoCount: 2, lastAutoAt: 100 };
    const once = foldWorker(mine, { lastAt: 500, date: 'd', count: 3, loginAt: 0 }, 'd');
    expect(once).toMatchObject({ autoCount: 5, workerCounted: 3, lastAutoAt: 500 });
    expect(foldWorker(once, { lastAt: 500, date: 'd', count: 3, loginAt: 0 }, 'd').autoCount).toBe(5);
    expect(ownReadsToday(once, 'd')).toBe(2);
    // A new day: yesterday's worker reads do not count.
    expect(foldWorker(once, { lastAt: 500, date: 'd', count: 3, loginAt: 0 }, 'e')).toMatchObject({ autoCount: 0, autoDate: 'e' });
  });
});
