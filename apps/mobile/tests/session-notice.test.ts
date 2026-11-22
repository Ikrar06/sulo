// "Masuk lagi" on the phone (M8c.3): watching on, the worker's single notice (Kotlin tests);
// watching off, a local estimate through core's rules; quiet hours; a tap opens sign-in.
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
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: { checkPermissions: async () => ({ display: 'granted' }), schedule: async () => undefined, cancel: async () => undefined, getPending: async () => ({ notifications: [] }), addListener: async () => ({ remove: async () => undefined }) } }));

const { createMobilePlatform } = await import('../src/platform');
const { planReminders, sessionForReminders, SESSION_ESTIMATE_SEC } = await import('../src/reminders');
const { opensSignIn, screenForNotification } = await import('../src/shell/notify-route');
const { switchUser, writeUser } = await import('@sulo/core/storage');
const { zonedToUnix } = await import('@sulo/core/reminders/zoned');
const { WATCH_KEY } = await import('../src/watch');

const TZ = 'Asia/Makassar';
const H = 3600;
const sessionNotices = (planned: { id: string; at: number }[]) => planned.filter((p) => p.id.startsWith('session|'));

async function phone(lastSyncAt: number, watching: boolean) {
  prefs.clear();
  const platform = createMobilePlatform();
  await switchUser(platform.store, 7);
  await writeUser(platform.store, 7, 'sync', { lastSyncAt, lastCourseListAt: lastSyncAt });
  if (watching) await platform.store.set(WATCH_KEY, { enabled: true });
  return platform;
}

describe('Masuk lagi on the phone', () => {
  beforeEach(() => prefs.clear());

  it('watching on: the reminders never add one (the worker sends a single notice and stops)', async () => {
    const now = zonedToUnix('2026-11-19', 12 * 60, TZ);
    const platform = await phone(now - 40 * H, true);
    expect((await sessionForReminders(platform.store, now)).state).toBe('OK');
    expect(sessionNotices(await planReminders(platform.store, now, TZ, 'id'))).toEqual([]);
  });

  it('watching off: estimated from the last sync, only once the data is over 24 hours old, at most once per 24 hours', async () => {
    const now = zonedToUnix('2026-11-19', 12 * 60, TZ);
    const platform = await phone(now - 2 * H, false);
    expect(await sessionForReminders(platform.store, now)).toMatchObject({ state: 'EXPIRED', expiredAt: now - 2 * H + SESSION_ESTIMATE_SEC });
    const planned = sessionNotices(await planReminders(platform.store, now, TZ, 'id'));
    // The first when the data turns 24 hours old (not at the estimated end of the session).
    expect(planned[0]?.at).toBe(now - 2 * H + 24 * H);
    // Never closer than 24 hours apart.
    for (let i = 1; i < planned.length; i++) expect(planned[i]!.at - planned[i - 1]!.at).toBeGreaterThanOrEqual(24 * H);
  });

  it('no sync yet: nothing', async () => {
    prefs.clear();
    const platform = createMobilePlatform();
    await switchUser(platform.store, 7);
    expect((await sessionForReminders(platform.store, 1_800_000_000)).state).toBe('OK');
  });

  it('quiet hours are respected: due at 23.00, it waits until 06.00', async () => {
    const last = zonedToUnix('2026-11-18', 23 * 60, TZ);
    const now = zonedToUnix('2026-11-19', 20 * 60, TZ);
    const platform = await phone(last, false);
    const planned = sessionNotices(await planReminders(platform.store, now, TZ, 'id'));
    expect(planned[0]?.at).toBe(zonedToUnix('2026-11-20', 6 * 60, TZ));
  });

  it('a tap on "Masuk lagi" opens sign-in, the worker\'s and the planner\'s alike; others open their screen', () => {
    expect(opensSignIn('session|s:1795000000')).toBe(true);
    expect(opensSignIn('session|watch:1795000000')).toBe(true);
    expect(opensSignIn('task|101|t:101:180:1795000000')).toBe(false);
    expect(screenForNotification('changes|task:101:added')).toEqual({ name: 'tugas', detail: '101' });
  });
});
