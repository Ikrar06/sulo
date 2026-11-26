// "Masuk lagi" on the phone (M8c.3; owner's decision of 26 Nov 2026): watching on, the worker's single
// notice (Kotlin tests); otherwise the offer rides in the morning summary, once a day, for every source
// whose session ended (SIKOLA estimated or known, Sipakamase, NEOSIA); quiet hours; a tap opens sign-in.
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
const { readPrefs, writePrefs } = await import('@sulo/core/prefs');

const TZ = 'Asia/Makassar';
const H = 3600;
const sessionNotices = (planned: { id: string; at: number }[]) => planned.filter((p) => p.id.startsWith('session|'));

async function phone(lastSyncAt: number, watching: boolean, morning = true) {
  prefs.clear();
  const platform = createMobilePlatform();
  await switchUser(platform.store, 7);
  await writeUser(platform.store, 7, 'sync', { lastSyncAt, lastCourseListAt: lastSyncAt });
  if (watching) await platform.store.set(WATCH_KEY, { enabled: true });
  if (morning) {
    const reminders = (await readPrefs(platform.store)).reminders;
    await writePrefs(platform.store, { reminders: { ...reminders, morning: { ...reminders.morning, enabled: true } } });
  }
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

  it('watching off: no notice of its own; the offer rides in the morning summary, once a day, after the estimated end', async () => {
    const now = zonedToUnix('2026-11-19', 12 * 60, TZ);
    const platform = await phone(now - 2 * H, false);
    const expiredAt = now - 2 * H + SESSION_ESTIMATE_SEC;
    expect(await sessionForReminders(platform.store, now)).toMatchObject({ state: 'EXPIRED', expiredAt });
    const planned = await planReminders(platform.store, now, TZ, 'id');
    // Owner's decision of 26 Nov 2026 (mobile rule 7): never a separate "Masuk lagi" notice on the phone.
    expect(planned.filter((p) => p.id.startsWith('session|s:'))).toEqual([]);
    const offers = sessionNotices(planned);
    expect(offers.length).toBeGreaterThan(0);
    for (const o of offers) {
      expect(o.id.startsWith('session|m:')).toBe(true);
      expect(o.at).toBeGreaterThanOrEqual(expiredAt);
      expect(o.view.message).toContain('Masuk lagi ke SIKOLA');
    }
    // At most once a day.
    for (let i = 1; i < offers.length; i++) expect(offers[i]!.at - offers[i - 1]!.at).toBeGreaterThanOrEqual(20 * H);
  });

  it('a session known to have ended is offered even while watching, with the other ended sources', async () => {
    const now = zonedToUnix('2026-11-19', 12 * 60, TZ);
    const platform = await phone(now - 1 * H, true);
    await platform.store.set('global:session', { state: 'EXPIRED', userId: 7, checkedAt: now - H, expiredAt: now - H });
    const offers = sessionNotices(await planReminders(platform.store, now, TZ, 'id', {}, ['Sipakamase']));
    expect(offers.length).toBeGreaterThan(0);
    expect(offers[0]!.view.message).toContain('Masuk lagi ke SIKOLA dan Sipakamase');
  });

  it('only another source ended: the offer names it alone; nothing ended, no offer', async () => {
    const now = zonedToUnix('2026-11-19', 12 * 60, TZ);
    const platform = await phone(now - 1 * H, true);
    expect(sessionNotices(await planReminders(platform.store, now, TZ, 'id'))).toEqual([]);
    const offers = sessionNotices(await planReminders(platform.store, now, TZ, 'id', {}, ['NEOSIA']));
    expect(offers[0]!.view.message).toContain('Masuk lagi ke NEOSIA');
  });

  it('morning summary off: one notice per ended session, never repeated', async () => {
    const now = zonedToUnix('2026-11-19', 12 * 60, TZ);
    const platform = await phone(now - 2 * H, false, false);
    const notices = sessionNotices(await planReminders(platform.store, now, TZ, 'id'));
    expect(notices).toHaveLength(1);
    expect(notices[0]!.id.startsWith('session|s:')).toBe(true);
    expect(notices[0]!.at).toBe(now - 2 * H + 24 * H);
  });

  it('no sync yet: nothing', async () => {
    prefs.clear();
    const platform = createMobilePlatform();
    await switchUser(platform.store, 7);
    expect((await sessionForReminders(platform.store, 1_800_000_000)).state).toBe('OK');
  });

  it('quiet hours are respected: the offer comes with the morning summary, never at night', async () => {
    const last = zonedToUnix('2026-11-18', 23 * 60, TZ);
    const now = zonedToUnix('2026-11-19', 20 * 60, TZ);
    const platform = await phone(last, false);
    const offers = sessionNotices(await planReminders(platform.store, now, TZ, 'id'));
    expect(offers.length).toBeGreaterThan(0);
    for (const o of offers) {
      const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(new Date(o.at * 1000)));
      expect(hour).toBeGreaterThanOrEqual(6);
      expect(hour).toBeLessThan(22);
    }
  });

  it('a tap on "Masuk lagi" opens sign-in, the worker\'s and the planner\'s alike; others open their screen', () => {
    expect(opensSignIn('session|s:1795000000')).toBe(true);
    expect(opensSignIn('session|watch:1795000000')).toBe(true);
    expect(opensSignIn('task|101|t:101:180:1795000000')).toBe(false);
    expect(screenForNotification('changes|task:101:added')).toEqual({ name: 'tugas', detail: '101' });
  });
});
