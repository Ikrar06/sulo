// The global switch (config enabled false): no request to SIKOLA from any
// path on the phone, while the config read itself keeps running.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prefs = new Map<string, string>();
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => void prefs.set(key, value),
    remove: async ({ key }: { key: string }) => void prefs.delete(key),
    keys: async () => ({ keys: [...prefs.keys()] }),
  },
}));
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: { schedule: async () => undefined, cancel: async () => undefined, getPending: async () => ({ notifications: [] }), addListener: async () => ({ remove: async () => undefined }) },
}));
const requests: unknown[] = [];
const pages: unknown[] = [];
const plans: string[] = [];
vi.mock('../src/session', () => ({
  SuloSession: {
    request: async (o: unknown) => (requests.push(o), { httpStatus: 200, body: '[]', sessionStatus: 'connected' }),
    page: async (o: unknown) => (pages.push(o), { httpStatus: 200, html: '', sessionStatus: 'connected' }),
    status: async () => ({ status: 'connected' }),
    watchApply: async ({ plan }: { plan: string }) => void plans.push(plan),
    watchTake: async () => ({ answers: [], fullSync: false }),
  },
}));

const { createMobilePlatform } = await import('../src/platform');
const { syncNow, syncAfterLogin, refreshPresensi } = await import('../src/sync');
const { applyWatchPlan } = await import('../src/watch-native');
const { REMOTE_CONFIG_KEY } = await import('@sulo/core/remote/remote-config');
const { switchUser } = await import('@sulo/core/storage');
const { updateWatch } = await import('../src/watch');

describe('paused by the maintainer', () => {
  beforeEach(() => {
    prefs.clear();
    requests.length = 0;
    pages.length = 0;
    plans.length = 0;
  });

  it('no sync, Perbarui, sign-in sync or attendance sends anything', async () => {
    const platform = createMobilePlatform();
    await platform.store.set(REMOTE_CONFIG_KEY, { enabled: false, minIntervalMinutes: 180, message: '', fetchedAt: platform.clock.now() });
    await switchUser(platform.store, 7);
    const opened = await syncNow(platform, { userInitiated: true });
    const background = await syncNow(platform, { userInitiated: false });
    await syncAfterLogin(platform);
    await refreshPresensi(platform, 'recap', null, true);
    expect(requests).toEqual([]);
    expect(pages).toEqual([]);
    expect(opened).toMatchObject({ status: 'skipped', reason: 'DISABLED_REMOTELY' });
    expect(background).toMatchObject({ status: 'skipped', reason: 'DISABLED_REMOTELY' });
  });

  it('the background plan is written switched off, even with the user switch on', async () => {
    const platform = createMobilePlatform();
    await platform.store.set(REMOTE_CONFIG_KEY, { enabled: false, minIntervalMinutes: 180, message: '', fetchedAt: platform.clock.now() });
    await switchUser(platform.store, 7);
    await updateWatch(platform, { enabled: true });
    await applyWatchPlan(platform);
    expect(JSON.parse(plans.at(-1)!)).toMatchObject({ enabled: false });
  });

  it('back on: the plan follows the user switch again', async () => {
    const platform = createMobilePlatform();
    await platform.store.set(REMOTE_CONFIG_KEY, { enabled: true, minIntervalMinutes: 180, message: '', fetchedAt: platform.clock.now() });
    await switchUser(platform.store, 7);
    await updateWatch(platform, { enabled: true });
    await applyWatchPlan(platform);
    const plan = JSON.parse(plans.at(-1)!);
    expect(plan).toMatchObject({ enabled: true, userId: 7, schedule: { dayIntervalMin: 20, nightIntervalMin: 60 } });
    expect(plan.calls.map((c: { methodname: string }) => c.methodname)).toEqual(['core_session_time_remaining', 'core_calendar_get_action_events_by_timesort', 'message_popup_get_popup_notifications']);
  });
});
