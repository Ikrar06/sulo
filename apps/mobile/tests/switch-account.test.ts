// Another SIKOLA account signed in on the phone (switch-account.ts): the
// same account goes on as usual; another one writes nothing until the user
// answers; "Pakai akun ini" removes everything of the previous account;
// "Batal" drops the new session and keeps the data; a closed app asks again;
// no notification of the previous account shows after the switch.
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
/** Notifications scheduled and not yet cancelled (the phone's list). */
const pending = new Map<number, string>();
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    schedule: async ({ notifications }: { notifications: { id: number; title: string }[] }) => notifications.forEach((n) => pending.set(n.id, n.title)),
    cancel: async ({ notifications }: { notifications: { id: number }[] }) => notifications.forEach((n) => pending.delete(n.id)),
    getPending: async () => ({ notifications: [...pending.keys()].map((id) => ({ id })) }),
    addListener: async () => ({ remove: async () => undefined }),
    checkPermissions: async () => ({ display: 'granted' }),
  },
}));

const session = { userid: 7, status: 'connected' as 'connected' | 'expired' | 'none' };
const calls: string[] = [];
const plans: string[] = [];
vi.mock('../src/session', async () => {
  const { FAKE_DATA } = await import('../src/fake/fixtures');
  return {
    SuloSession: {
      request: async ({ body }: { body: string }) => {
        const list = JSON.parse(body) as { methodname: string }[];
        const results = list.map((c) => ({ error: false, data: c.methodname === 'core_session_time_remaining' ? { userid: session.userid, timeremaining: 7200 } : (FAKE_DATA[c.methodname] ?? {}) }));
        return { httpStatus: 200, body: JSON.stringify(results), sessionStatus: 'connected' };
      },
      page: async () => ({ httpStatus: 404, html: '', sessionStatus: 'connected' }),
      status: async () => ({ status: session.status }),
      watchApply: async ({ plan }: { plan: string }) => void plans.push(plan),
      watchTake: async () => ({ answers: [], fullSync: false }),
      watchReset: async () => void calls.push('watchReset'),
      discardSession: async () => (calls.push('discardSession'), (session.status = 'expired'), { status: 'expired' }),
    },
  };
});

const { createMobilePlatform } = await import('../src/platform');
const { syncNow } = await import('../src/sync');
const { applyWatchPlan } = await import('../src/watch-native');
const { scheduleReminders } = await import('../src/reminders');
const { holdWatching, keepPreviousAccount, switchPending, useOtherAccount } = await import('../src/switch-account');
const { ACCOUNT_PENDING_KEY } = await import('@sulo/core/account/pending');
const { currentUser, readUser } = await import('@sulo/core/storage');
const { readPrefs, writePrefs } = await import('@sulo/core/prefs');
const { DEFAULT_REMINDER_SETTINGS } = await import('@sulo/core/reminders/settings');

/** The previous account (7) with its data, a nickname and reminders on. */
async function previousAccount() {
  const platform = createMobilePlatform();
  session.userid = 7;
  session.status = 'connected';
  expect(await syncNow(platform, { userInitiated: true })).toMatchObject({ status: 'ok' });
  await writePrefs(platform.store, { nickname: 'Andi', reminders: { ...DEFAULT_REMINDER_SETTINGS, enabled: true } });
  await scheduleReminders(platform);
  return platform;
}

/** Signing in again comes long after the last sync (past the 2-minute Perbarui cooldown). */
const later = () => vi.setSystemTime(Date.now() + 15 * 60_000);

const userKeys = (id: number) => [...prefs.keys()].filter((k) => k.includes(`u:${id}:`));

describe('another account on the phone', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-19T02:00:00Z'));
    prefs.clear();
    pending.clear();
    calls.length = 0;
    plans.length = 0;
  });

  it('the same account goes on as usual: no question', async () => {
    const platform = await previousAccount();
    later();
    expect(await syncNow(platform, { userInitiated: true })).toMatchObject({ status: 'ok' });
    expect(await switchPending(platform)).toBe(false);
  });

  it('another account: nothing of it is written, the previous data stays, the question is due', async () => {
    const platform = await previousAccount();
    const before = userKeys(7).length;
    session.userid = 9;
    later();
    const outcome = await syncNow(platform, { userInitiated: true });
    expect(outcome).toMatchObject({ status: 'account_mismatch' });
    expect(await switchPending(platform, outcome)).toBe(true);
    expect(userKeys(9)).toEqual([]);
    expect(userKeys(7).length).toBe(before);
    expect(await currentUser(platform.store)).toBe(7);
  });

  it('"Pakai akun ini": every trace of the previous account goes, and its notifications', async () => {
    const platform = await previousAccount();
    expect(pending.size).toBeGreaterThan(0);
    session.userid = 9;
    later();
    await syncNow(platform, { userInitiated: true });
    expect(await useOtherAccount(platform)).toBe(true);
    expect(userKeys(7)).toEqual([]);
    expect(await currentUser(platform.store)).toBe(9);
    expect((await readPrefs(platform.store)).nickname).toBe('');
    // General settings stay.
    expect((await readPrefs(platform.store)).reminders.enabled).toBe(true);
    expect(prefs.has(`sulo:${ACCOUNT_PENDING_KEY}`) || [...prefs.keys()].some((k) => k.endsWith(ACCOUNT_PENDING_KEY))).toBe(false);
    expect(calls).toContain('watchReset');
    later();
    // No notification of the previous account is left to show.
    expect(pending.size).toBe(0);
    // The new account's first sync then writes its own data.
    expect(await syncNow(platform, { userInitiated: true })).toMatchObject({ status: 'ok' });
    expect((await readUser(platform.store, 9, 'tasks')).length).toBeGreaterThan(0);
  });

  it('"Batal": the new session is dropped, the previous data stays and can be read', async () => {
    const platform = await previousAccount();
    const tasks = await readUser(platform.store, 7, 'tasks');
    session.userid = 9;
    later();
    await syncNow(platform, { userInitiated: true });
    await keepPreviousAccount(platform);
    expect(calls).toContain('discardSession');
    expect(session.status).toBe('expired');
    expect(await switchPending(platform)).toBe(false);
    expect(await currentUser(platform.store)).toBe(7);
    expect(await readUser(platform.store, 7, 'tasks')).toEqual(tasks);
    expect(userKeys(9)).toEqual([]);
  });

  it('closed while the question is open: asked again on opening, still nothing stored', async () => {
    const platform = await previousAccount();
    session.userid = 9;
    later();
    await syncNow(platform, { userInitiated: true });
    // A new launch over the same storage.
    const again = createMobilePlatform();
    expect(await switchPending(again)).toBe(true);
    expect(userKeys(9)).toEqual([]);
    expect(await currentUser(again.store)).toBe(7);
  });

  it('while the question is open: no background plan in force and no reminder of the previous account', async () => {
    const platform = await previousAccount();
    expect(pending.size).toBeGreaterThan(0);
    session.userid = 9;
    later();
    await syncNow(platform, { userInitiated: true });
    await holdWatching();
    await applyWatchPlan(platform);
    expect(JSON.parse(plans.at(-1)!)).toMatchObject({ enabled: false });
    await scheduleReminders(platform);
    expect(pending.size).toBe(0);
  });
});
