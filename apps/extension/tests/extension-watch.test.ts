import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MoodleCall } from '@sulo/core/moodle/calls';
import { batchPath, createMoodleClient, type MoodleClient, type RequestOptions } from '@sulo/core/moodle/client';
import { EXTENSION_WATCH, WATCH_STOP } from '@sulo/core/moodle/limits';
import { DEFAULT_EXTENSION_WATCH, parseExtensionWatch } from '@sulo/core/remote/extension-watch';
import { remoteConfigSchema } from '@sulo/core/remote/remote-config';
import { runSync } from '@sulo/core/sync/run-sync';
import { readExtensionWatch, setExtensionWatch, watchInForce } from '@sulo/core/watch/extension';
import type { RemoteConfig } from '@sulo/core/types';
import { fixedClock, jsonResponse, memoryStore } from './helpers';

const fx = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/synthetic/${name}.json`, import.meta.url), 'utf8'));
const NOW = 1_790_000_000;
const MIN = 60;

/** A SIKOLA stand-in that records every batch: its calls and its options. */
function fakeClient() {
  const all = fx('enrolled-courses.normal');
  const batches: { calls: string[]; options: RequestOptions }[] = [];
  const pages: string[] = [];
  const c: MoodleClient = {
    async callBatch(calls: readonly MoodleCall[], options: RequestOptions = {}) {
      batches.push({ calls: calls.map((x) => x.methodname), options });
      return {
        kind: 'ok',
        results: calls.map((x) => ({
          ok: true,
          data:
            x.methodname === 'core_session_time_remaining' ? { userid: 1, timeremaining: 7200 }
            : x.methodname === 'core_calendar_get_action_events_by_timesort' ? fx('calendar-action-events.normal')
            : x.methodname === 'message_popup_get_popup_notifications' ? fx('popup-notifications.normal')
            : x.methodname === 'core_courseformat_get_state' ? fx('courseformat-state.normal')
            : x.args.classification === 'inprogress' ? { courses: all.courses.filter((k: { id: number }) => [401, 402, 403].includes(k.id)), nextoffset: 3 } : all,
        })),
      };
    },
    async fetchPage(path: string) {
      pages.push(path);
      return { kind: 'network_error' };
    },
  };
  return Object.assign(c, { batches, pages });
}

/** A store after the setup's first sync at NOW, 10.00. */
async function afterSetup() {
  const store = memoryStore();
  const client = fakeClient();
  await runSync({ client, store, clock: fixedClock('2026-09-22', 10, NOW), trigger: 'onboarding' });
  client.batches.length = 0;
  client.pages.length = 0;
  return { store, client };
}

describe('the watch check (extension "Pantau tugas baru")', () => {
  it('runs every 15 minutes while the computer is in use, and keeps the session', async () => {
    const { store, client } = await afterSetup();
    expect(await runSync({ client, store, clock: fixedClock('2026-09-22', 10, NOW + 10 * MIN), trigger: 'watch', idleState: 'active' })).toMatchObject({ status: 'skipped', reason: 'FRESH' });
    expect(client.batches).toHaveLength(0);
    expect(await runSync({ client, store, clock: fixedClock('2026-09-22', 10, NOW + 15 * MIN), trigger: 'watch', idleState: 'active' })).toMatchObject({ status: 'ok' });
    expect(client.batches).toHaveLength(1);
    expect(client.batches[0]!.options).toMatchObject({ source: 'watch', keepSession: true });
  });

  it('waits the longer interval while the computer is idle, and never runs while it is locked', async () => {
    const { store, client } = await afterSetup();
    expect(await runSync({ client, store, clock: fixedClock('2026-09-22', 10, NOW + 20 * MIN), trigger: 'watch', idleState: 'idle' })).toMatchObject({ status: 'skipped', reason: 'FRESH' });
    expect(await runSync({ client, store, clock: fixedClock('2026-09-22', 10, NOW + 2 * 3600), trigger: 'watch', idleState: 'locked' })).toMatchObject({ status: 'skipped', reason: 'IDLE' });
    expect(await runSync({ client, store, clock: fixedClock('2026-09-22', 10, NOW + 30 * MIN), trigger: 'watch', idleState: 'idle' })).toMatchObject({ status: 'ok' });
  });

  it('follows slower intervals from the remote config', async () => {
    const { store, client } = await afterSetup();
    const watch = { activeMinutes: 40, idleMinutes: 60 };
    expect(await runSync({ client, store, clock: fixedClock('2026-09-22', 10, NOW + 20 * MIN), trigger: 'watch', idleState: 'active', watch })).toMatchObject({ reason: 'FRESH' });
    expect(await runSync({ client, store, clock: fixedClock('2026-09-22', 10, NOW + 40 * MIN), trigger: 'watch', idleState: 'active', watch })).toMatchObject({ status: 'ok' });
  });

  it('never runs between 00.00 and 06.00', async () => {
    const { store, client } = await afterSetup();
    expect(await runSync({ client, store, clock: fixedClock('2026-09-23', 2, NOW + 16 * 3600), trigger: 'watch', idleState: 'active' })).toMatchObject({ status: 'skipped', reason: 'QUIET_HOURS' });
  });

  it('fetches notifications every time, not every 3 hours, and leaves out the attendance recap', async () => {
    const { store, client } = await afterSetup();
    await runSync({ client, store, clock: fixedClock('2026-09-22', 10, NOW + 15 * MIN), trigger: 'watch', idleState: 'active' });
    await runSync({ client, store, clock: fixedClock('2026-09-22', 10, NOW + 30 * MIN), trigger: 'watch', idleState: 'active' });
    expect(client.batches).toHaveLength(2);
    for (const b of client.batches) expect(b.calls).toContain('message_popup_get_popup_notifications');
    expect(client.pages).toEqual([]);
  });

  it('stops for the day at the watch limit, while "Perbarui" still runs', async () => {
    const { store, client } = await afterSetup();
    await store.set('global:budget', { date: '2026-09-22', used: WATCH_STOP.posts, calls: 300 });
    expect(await runSync({ client, store, clock: fixedClock('2026-09-22', 10, NOW + 60 * MIN), trigger: 'watch', idleState: 'active' })).toMatchObject({ status: 'skipped', reason: 'WATCH_STOPPED' });
    expect(await runSync({ client, store, clock: fixedClock('2026-09-22', 10, NOW + 60 * MIN), trigger: 'popup' })).toMatchObject({ status: 'skipped', reason: 'WATCH_STOPPED' });
    expect(await runSync({ client, store, clock: fixedClock('2026-09-22', 10, NOW + 60 * MIN), trigger: 'manual' })).toMatchObject({ status: 'ok' });
  });

  it('an ordinary background sync still sends nosessionupdate', async () => {
    const { store, client } = await afterSetup();
    await runSync({ client, store, clock: fixedClock('2026-09-22', 14, NOW + 4 * 3600), trigger: 'background', idleState: 'active' });
    expect(client.batches[0]!.options.keepSession).toBeFalsy();
  });
});

describe('the popup check', () => {
  it('runs when the last check is older than 2 minutes, at any hour, and keeps the session', async () => {
    const { store, client } = await afterSetup();
    expect(await runSync({ client, store, clock: fixedClock('2026-09-22', 10, NOW + 1 * MIN), trigger: 'popup' })).toMatchObject({ reason: 'FRESH' });
    expect(await runSync({ client, store, clock: fixedClock('2026-09-23', 1, NOW + EXTENSION_WATCH.popupFreshMinutes * MIN), trigger: 'popup' })).toMatchObject({ status: 'ok' });
    expect(client.batches[0]!.options).toMatchObject({ source: 'popup', keepSession: true });
  });
});

describe('keepSession on the wire', () => {
  it('drops nosessionupdate for that batch only', async () => {
    const urls: string[] = [];
    const store = memoryStore();
    const client = createMoodleClient({
      fetch: async (input) => {
        urls.push(String(input));
        return jsonResponse([{ error: false, data: { userid: 1, timeremaining: 7200 } }]);
      },
      store,
      clock: fixedClock(),
      baseUrl: 'https://sikola-v2.unhas.ac.id',
      getSesskey: async () => 'abcdEFGH12',
    });
    const one = [{ methodname: 'core_session_time_remaining', args: {} }] as MoodleCall[];
    await client.callBatch(one, { source: 'background' });
    await client.callBatch(one, { source: 'watch', keepSession: true });
    expect(urls[0]).toContain('nosessionupdate=true');
    expect(urls[1]).not.toContain('nosessionupdate');
    expect(batchPath('abcdEFGH12')).toContain('nosessionupdate=true');
  });
});

describe('watch switch and remote config', () => {
  const config = (extra: Partial<RemoteConfig> & Record<string, unknown> = {}): RemoteConfig => ({ enabled: true, minIntervalMinutes: 180, message: '', fetchedAt: 0, ...extra });

  it('is off until the user turns it on', async () => {
    const store = memoryStore();
    expect(await readExtensionWatch(store)).toEqual({ enabled: false, changedAt: null });
    await setExtensionWatch(store, true, 5);
    expect(await readExtensionWatch(store)).toEqual({ enabled: true, changedAt: 5 });
  });

  it('runs only when the user, the global switch and the watch switch all allow it', () => {
    expect(watchInForce({ enabled: true, changedAt: 1 }, config()).on).toBe(true);
    expect(watchInForce({ enabled: false, changedAt: 1 }, config()).on).toBe(false);
    expect(watchInForce({ enabled: true, changedAt: 1 }, config({ enabled: false }))).toMatchObject({ on: false, chosen: true, stoppedRemotely: true });
    expect(watchInForce({ enabled: true, changedAt: 1 }, config({ extension: { backgroundWatch: { enabled: false } } })).on).toBe(false);
    expect(watchInForce({ enabled: true, changedAt: 1 }, null).on).toBe(true);
  });

  it('reads intervals field by field, only slower than the defaults', () => {
    expect(parseExtensionWatch(undefined)).toEqual(DEFAULT_EXTENSION_WATCH);
    expect(parseExtensionWatch({ backgroundWatch: { activeIntervalMinutes: 30, idleIntervalMinutes: 90 } })).toMatchObject({ enabled: true, activeIntervalMinutes: 30, idleIntervalMinutes: 90 });
    expect(parseExtensionWatch({ backgroundWatch: { activeIntervalMinutes: 5, idleIntervalMinutes: 'x' } })).toMatchObject({ activeIntervalMinutes: 15, idleIntervalMinutes: 30 });
  });

  it('refuses a file whose switch is there but not a boolean', () => {
    const base = { enabled: true, minIntervalMinutes: 180, message: '' };
    expect(remoteConfigSchema.safeParse({ ...base, extension: { backgroundWatch: { enabled: 'yes' } } }).success).toBe(false);
    expect(remoteConfigSchema.safeParse({ ...base, extension: { backgroundWatch: { enabled: false } } }).success).toBe(true);
    expect(remoteConfigSchema.safeParse({ ...base, extension: 'x' }).success).toBe(false);
    expect(remoteConfigSchema.safeParse(base).success).toBe(true);
  });
});
