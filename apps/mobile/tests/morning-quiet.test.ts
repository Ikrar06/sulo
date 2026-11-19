// The morning summary inside quiet hours (Tahap 2): moved to the end of the
// window and sent there once, never dropped. The phone plans its reminders
// ahead by playing core's planner forward (src/reminders.ts planReminders).
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
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: { schedule: async () => undefined, cancel: async () => undefined, getPending: async () => ({ notifications: [] }), addListener: async () => ({ remove: async () => undefined }) } }));

const { createMobilePlatform } = await import('../src/platform');
const { planReminders } = await import('../src/reminders');
const { switchUser, writeUser } = await import('@sulo/core/storage');
const { zonedToUnix } = await import('@sulo/core/reminders/zoned');
const { DEFAULT_REMINDERS } = await import('@sulo/core/reminders/settings');
const { DEFAULT_PREFS } = await import('@sulo/core/prefs');

const TZ = 'Asia/Makassar';
const H = 3600;

async function phone(now: number, quiet: { enabled: boolean; startMin: number; endMin: number }) {
  prefs.clear();
  const platform = createMobilePlatform();
  await switchUser(platform.store, 7);
  await writeUser(platform.store, 7, 'sync', { lastSyncAt: now, lastCourseListAt: now });
  await writeUser(platform.store, 7, 'courses', [{ id: 5, fullname: 'HIDROLOGI A [D001]', shortname: 'H', startdate: now - 30 * 86_400, enddate: 0, parsed: { name: 'Hidrologi', classLabel: 'A', code: 'D001' }, inProgress: true, past: false, activeScore: 0, activeReasons: [], activePin: true, alias: null, color: null }]);
  // One overdue task, so the summary has something to say every morning.
  await writeUser(platform.store, 7, 'tasks', [{ eventId: 1, cmId: 1, courseId: 5, name: 'Laporan 1', module: 'assign', dueAt: now - 2 * H, url: '', overdue: true, firstSeenAt: now, lastSeenAt: now, missingSince: null }]);
  await platform.store.set('global:prefs', { ...DEFAULT_PREFS, reminders: { ...DEFAULT_REMINDERS, enabled: true, morning: { enabled: true, atMin: 7 * 60 }, quiet } });
  return platform;
}

describe('morning summary in quiet hours (the phone)', () => {
  beforeEach(() => prefs.clear());

  it('a 07.00 summary inside quiet hours 22.00 to 08.00 is planned once, at 08.00', async () => {
    const now = zonedToUnix('2026-11-20', 5 * 60, TZ);
    const platform = await phone(now, { enabled: true, startMin: 22 * 60, endMin: 8 * 60 });
    const mornings = (await planReminders(platform.store, now, TZ, 'id')).filter((p) => p.id.startsWith('morning|'));
    const today = mornings.filter((p) => p.at < zonedToUnix('2026-11-21', 0, TZ));
    expect(today.map((p) => p.at)).toEqual([zonedToUnix('2026-11-20', 8 * 60, TZ)]);
  });

  it('outside quiet hours it stays at 07.00', async () => {
    const now = zonedToUnix('2026-11-20', 5 * 60, TZ);
    const platform = await phone(now, { enabled: true, startMin: 22 * 60, endMin: 6 * 60 });
    const first = (await planReminders(platform.store, now, TZ, 'id')).find((p) => p.id.startsWith('morning|'));
    expect(first?.at).toBe(zonedToUnix('2026-11-20', 7 * 60, TZ));
  });
});
