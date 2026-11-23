// The notification permission (P-03): only the onboarding's "Izinkan
// pengingat" button may make Android ask. Scheduling reminders, showing a
// notification and setting an alarm first read the permission and do nothing
// without it; none of them ever asks.
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

type Display = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';
const phone = { display: 'prompt' as Display, scheduled: [] as { id: number }[][], cancelled: 0, asked: 0 };
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: async () => ({ display: phone.display }),
    requestPermissions: async () => {
      phone.asked += 1;
      return { display: phone.display };
    },
    schedule: async ({ notifications }: { notifications: { id: number }[] }) => {
      // What the real plugin does on Android 13 and later: without permission, schedule() itself asks.
      if (phone.display !== 'granted') phone.asked += 1;
      phone.scheduled.push(notifications);
    },
    cancel: async () => void (phone.cancelled += 1),
    getPending: async () => ({ notifications: [] }),
    addListener: async () => ({ remove: async () => undefined }),
  },
}));

const { createMobilePlatform } = await import('../src/platform');
const { createAlarmScheduler, createNotifier, notificationsAllowed } = await import('../src/platform/notifications');
const { planReminders, scheduleIfNoneScheduled, scheduleReminders, SCHEDULED_KEY } = await import('../src/reminders');
const { switchUser, writeUser } = await import('@sulo/core/storage');

/** A signed-in phone whose data is two days old with watching off: the plan holds at least the "sign in again" notice. */
async function phoneWithAPlan() {
  prefs.clear();
  const platform = createMobilePlatform();
  const old = platform.clock.now() - 48 * 3600;
  await switchUser(platform.store, 7);
  await writeUser(platform.store, 7, 'sync', { lastSyncAt: old, lastCourseListAt: old });
  const planned = await planReminders(platform.store, platform.clock.now(), Intl.DateTimeFormat().resolvedOptions().timeZone, 'id');
  expect(planned.length).toBeGreaterThan(0);
  return platform;
}

describe('the notification permission is asked in one place only', () => {
  beforeEach(() => {
    phone.display = 'prompt';
    phone.scheduled = [];
    phone.cancelled = 0;
    phone.asked = 0;
  });

  it('not asked yet: nothing is scheduled and Android is not made to ask', async () => {
    const platform = await phoneWithAPlan();
    expect(await scheduleReminders(platform)).toBe(0);
    expect(phone.scheduled).toHaveLength(0);
    expect(phone.asked).toBe(0);
  });

  it('allowed: the plan is scheduled, without asking', async () => {
    const platform = await phoneWithAPlan();
    phone.display = 'granted';
    const n = await scheduleReminders(platform);
    expect(n).toBeGreaterThan(0);
    expect(phone.scheduled).toHaveLength(1);
    expect(phone.scheduled[0]).toHaveLength(n);
    expect(await platform.store.get<number[]>(SCHEDULED_KEY)).toHaveLength(n);
    expect(phone.asked).toBe(0);
  });

  it('refused: nothing is scheduled, nothing is asked again', async () => {
    const platform = await phoneWithAPlan();
    phone.display = 'denied';
    expect(await scheduleReminders(platform)).toBe(0);
    expect(phone.scheduled).toHaveLength(0);
    expect(phone.asked).toBe(0);
  });

  it('allowed later in the phone settings: coming back to the app schedules the plan, once', async () => {
    const platform = await phoneWithAPlan();
    expect(await scheduleIfNoneScheduled(platform)).toBe(0);
    phone.display = 'granted';
    expect(await scheduleIfNoneScheduled(platform)).toBeGreaterThan(0);
    expect(phone.scheduled).toHaveLength(1);
    // A plan is in place: coming back again does nothing.
    expect(await scheduleIfNoneScheduled(platform)).toBe(0);
    expect(phone.scheduled).toHaveLength(1);
    expect(phone.asked).toBe(0);
  });

  it('showing a notification and setting an alarm also wait for the permission', async () => {
    const { store } = createMobilePlatform();
    expect(await notificationsAllowed()).toBe(false);
    await createNotifier(store).show('x', { title: 'a', message: 'b', icon: 'idle' } as never);
    await createAlarmScheduler(store).schedule('y', { delayMinutes: 5 });
    expect(phone.scheduled).toHaveLength(0);
    expect(phone.asked).toBe(0);
    phone.display = 'granted';
    await createNotifier(store).show('x', { title: 'a', message: 'b', icon: 'idle' } as never);
    await createAlarmScheduler(store).schedule('y', { delayMinutes: 5 });
    expect(phone.scheduled).toHaveLength(2);
    expect(phone.asked).toBe(0);
  });
});
