// The notification sound (owner's rules, 23 Nov 2026): one saved choice,
// one channel plan for the app's own notifications and for the background
// worker, channels swapped when the choice changes, and no question about
// the notification permission from any of it.
import { readdirSync, readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { channelChanges, channelFor, type ChannelPlan } from '@sulo/core/notify/channels';

const prefs = new Map<string, string>();
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => void prefs.set(key, value),
    remove: async ({ key }: { key: string }) => void prefs.delete(key),
    keys: async () => ({ keys: [...prefs.keys()] }),
  },
}));

type Display = 'prompt' | 'granted' | 'denied';
interface Scheduled {
  id: number;
  channelId?: string;
  extra?: { suloId?: string };
}
/** A stand-in phone: its channels (by id, with what each was made with), what was scheduled, and whether anything made Android ask. */
const phone = { display: 'prompt' as Display, channels: new Map<string, { sound: string | null; importance: string; name: string }>(), applied: [] as ChannelPlan[], scheduled: [] as Scheduled[][], asked: 0 };

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: async () => ({ display: phone.display }),
    requestPermissions: async () => {
      phone.asked += 1;
      return { display: phone.display };
    },
    schedule: async ({ notifications }: { notifications: Scheduled[] }) => {
      // What the real plugin does on Android 13 and later: without permission, schedule() itself asks.
      if (phone.display !== 'granted') phone.asked += 1;
      phone.scheduled.push(notifications);
    },
    cancel: async () => undefined,
    getPending: async () => ({ notifications: [] }),
    addListener: async () => ({ remove: async () => undefined }),
  },
}));

// The native side of the channels, played by core's own rule (NotifyChannels.kt follows the same vectors).
vi.mock('@capacitor/core', async (original) => {
  const real = await original<typeof import('@capacitor/core')>();
  const notify = {
    applyChannels: async ({ plan }: { plan: string }) => {
      const p = JSON.parse(plan) as ChannelPlan;
      phone.applied.push(p);
      const todo = channelChanges([...phone.channels.keys()], p);
      for (const c of todo.create) phone.channels.set(c.id, { sound: c.sound, importance: c.importance, name: c.name });
      for (const id of todo.remove) phone.channels.delete(id);
      return { created: todo.create.map((c) => c.id), removed: todo.remove, channels: [...phone.channels.keys()].sort() };
    },
  };
  return { ...real, registerPlugin: (name: string, impl?: never) => (name === 'SuloNotify' ? notify : real.registerPlugin(name, impl)) };
});

const { createMobilePlatform } = await import('../src/platform');
const { applyNotifyChannels, changeNotifySound, NOTIFY_SOUND_KEY, previewFile, readChannelPlan, readNotifySound } = await import('../src/notify-sound');
const { scheduleOnChannels } = await import('../src/platform/notifications');
const { planReminders, scheduleReminders } = await import('../src/reminders');
const { buildWatchPlan } = await import('@sulo/core/watch/plan');
const { DEFAULT_KEEP_ALIVE } = await import('@sulo/core/remote/keep-alive');
const { mobileWords } = await import('@sulo/core/i18n/mobile');
const { switchUser, writeUser } = await import('@sulo/core/storage');

const ids = () => [...phone.channels.keys()].sort();
const sounded = () => ids().filter((id) => /^sulo_(tenggat|kabar)_/.test(id));

beforeEach(() => {
  prefs.clear();
  phone.display = 'prompt';
  phone.channels.clear();
  phone.applied = [];
  phone.scheduled = [];
  phone.asked = 0;
});

describe('the saved choice', () => {
  it('a new install has the first sound; anything unreadable counts as none saved', async () => {
    const { store } = createMobilePlatform();
    expect(await readNotifySound(store)).toBe('sound1');
    await store.set(NOTIFY_SOUND_KEY, 'loud');
    expect(await readNotifySound(store)).toBe('sound1');
    await store.set(NOTIFY_SOUND_KEY, 'silent');
    expect(await readNotifySound(store)).toBe('silent');
  });
});

describe('the channels on the phone', () => {
  it('a first run makes one channel per kind, with the first sound on reminders and news', async () => {
    const { store } = createMobilePlatform();
    await applyNotifyChannels(store);
    expect(ids()).toEqual(['sulo_jeda', 'sulo_kabar_suara1', 'sulo_pagi', 'sulo_sesi', 'sulo_tenggat_suara1']);
    expect(phone.channels.get('sulo_tenggat_suara1')).toMatchObject({ sound: 'sulo_notif_1', importance: 'default' });
    expect(phone.channels.get('sulo_kabar_suara1')).toMatchObject({ sound: 'sulo_notif_1', importance: 'default' });
    // Named as the phone's settings will show them, in the app's language (here whatever this machine's language resolves to).
    const names = [mobileWords('id'), mobileWords('en')].map((w) => w.notifySound.channels);
    expect(names.map((n) => n.due)).toContain(phone.channels.get('sulo_tenggat_suara1')!.name);
    expect(names.map((n) => n.news)).toContain(phone.channels.get('sulo_kabar_suara1')!.name);
    for (const id of ['sulo_pagi', 'sulo_sesi', 'sulo_jeda']) expect(phone.channels.get(id)).toMatchObject({ sound: null, importance: 'low' });
  });

  it('channels of the version before are moved over: the worker\'s single channel and the plugin\'s catch-all are removed', async () => {
    const { store } = createMobilePlatform();
    phone.channels.set('default', { sound: 'default', importance: 'default', name: 'Default' });
    phone.channels.set('sulo_kabar', { sound: 'default', importance: 'default', name: 'Kabar dari SIKOLA' });
    await applyNotifyChannels(store);
    expect(ids()).toEqual(['sulo_jeda', 'sulo_kabar_suara1', 'sulo_pagi', 'sulo_sesi', 'sulo_tenggat_suara1']);
  });

  it('another sound makes new channels and removes the old ones: never two channels of one kind', async () => {
    const { store } = createMobilePlatform();
    await applyNotifyChannels(store);
    const want: Record<string, [string, string | null, string]> = { sound3: ['suara3', 'sulo_notif_3', 'default'], device: ['bawaan', 'default', 'default'], silent: ['senyap', null, 'low'], sound2: ['suara2', 'sulo_notif_2', 'default'], sound4: ['suara4', 'sulo_notif_4', 'default'], sound1: ['suara1', 'sulo_notif_1', 'default'] };
    for (const [sound, [tag, raw, importance]] of Object.entries(want)) {
      await changeNotifySound(store, sound as never);
      expect(await readNotifySound(store)).toBe(sound);
      expect(sounded()).toEqual([`sulo_kabar_${tag}`, `sulo_tenggat_${tag}`]);
      expect(ids()).toHaveLength(5);
      for (const id of sounded()) expect(phone.channels.get(id)).toMatchObject({ sound: raw, importance });
      // The silent kinds keep their channels through every change.
      for (const id of ['sulo_pagi', 'sulo_sesi', 'sulo_jeda']) expect(phone.channels.has(id)).toBe(true);
    }
  });

  it('the same choice again changes nothing on the phone', async () => {
    const { store } = createMobilePlatform();
    await changeNotifySound(store, 'sound2');
    const before = ids();
    await changeNotifySound(store, 'sound2');
    await applyNotifyChannels(store);
    expect(ids()).toEqual(before);
  });
});

describe('one choice for both paths', () => {
  it('the app\'s own notifications go to the channel of their kind under the saved choice', async () => {
    const { store } = createMobilePlatform();
    await changeNotifySound(store, 'sound3');
    phone.display = 'granted';
    await scheduleOnChannels(store, [
      { id: 1, title: 'a', body: '', extra: { suloId: 'task|101|t:101:h1' } },
      { id: 2, title: 'b', body: '', extra: { suloId: 'calendar|c:uts:h7' } },
      { id: 3, title: 'c', body: '', extra: { suloId: 'changes|task:101:added' } },
      { id: 4, title: 'd', body: '', extra: { suloId: 'morning|m:2026-11-23' } },
      { id: 5, title: 'e', body: '', extra: { suloId: 'session|s:1' } },
      // The test notification of Pengaturan: a reminder like any other.
      { id: 6, title: 'f', body: '', extra: { suloId: 'test|1' } },
    ]);
    expect(phone.scheduled[0]!.map((n) => n.channelId)).toEqual(['sulo_tenggat_suara3', 'sulo_tenggat_suara3', 'sulo_kabar_suara3', 'sulo_pagi', 'sulo_sesi', 'sulo_tenggat_suara3']);
    // Every channel named exists on the phone.
    for (const n of phone.scheduled[0]!) expect(phone.channels.has(n.channelId!)).toBe(true);
  });

  it('the worker reads the same plan: what the watch plan carries is what the app applied, and its ids land on the same channels', async () => {
    const { store } = createMobilePlatform();
    const applied = await changeNotifySound(store, 'sound4');
    const words = mobileWords('id');
    const watch = buildWatchPlan({
      now: 1_795_000_000,
      userId: 7,
      userEnabled: true,
      keepAlive: DEFAULT_KEEP_ALIVE,
      globalEnabled: true,
      sessionConnected: true,
      remoteRead: { okAt: 1, readAt: 1, url: 'https://ikrar06.github.io/sulo-data/config.json' },
      tasks: [],
      calendarBaseline: true,
      notificationLastId: null,
      radarCourseIds: [],
      snapshots: {},
      announcedCms: [],
      updates: { materials: true, deadlines: true, grades: true, forum: false },
      quiet: { enabled: false, startMin: 0, endMin: 0 },
      courseNames: {},
      templates: words.watch.templates,
      channels: await readChannelPlan(store),
    });
    // As the worker gets it: through JSON.
    const carried = (JSON.parse(JSON.stringify(watch)) as { channels: ChannelPlan }).channels;
    expect(carried).toEqual(applied);
    expect(carried).toEqual(phone.applied.at(-1));
    expect(channelFor(carried, 'changes|task:9:added')).toBe('sulo_kabar_suara4');
    expect(channelFor(carried, 'changes_summary|cs:1')).toBe('sulo_kabar_suara4');
    expect(channelFor(carried, 'session|watch:1795000000')).toBe('sulo_sesi');
    expect(channelFor(carried, 'watch|paused:1795000000')).toBe('sulo_jeda');
    // And the app's reminders of the same moment name the same channels.
    expect(channelFor(await readChannelPlan(store), 'task|1|x')).toBe('sulo_tenggat_suara4');
  });

  it('a plan written before the channel plan existed still builds: the field is simply absent', () => {
    const watch = buildWatchPlan({ now: 1, userId: 7, userEnabled: true, keepAlive: DEFAULT_KEEP_ALIVE, globalEnabled: true, sessionConnected: true, remoteRead: { okAt: 1, readAt: 1, url: 'https://ikrar06.github.io/sulo-data/config.json' }, tasks: [], calendarBaseline: true, notificationLastId: null, radarCourseIds: [], snapshots: {}, announcedCms: [], updates: { materials: true, deadlines: true, grades: true, forum: false }, quiet: { enabled: false, startMin: 0, endMin: 0 }, courseNames: {}, templates: mobileWords('id').watch.templates });
    expect('channels' in watch).toBe(false);
  });
});

describe('the notification permission is not touched', () => {
  /** A signed-in phone whose data is two days old: the reminder plan holds at least the "sign in again" notice. */
  async function phoneWithAPlan() {
    const platform = createMobilePlatform();
    const old = platform.clock.now() - 48 * 3600;
    await switchUser(platform.store, 7);
    await writeUser(platform.store, 7, 'sync', { lastSyncAt: old, lastCourseListAt: old });
    expect((await planReminders(platform.store, platform.clock.now(), Intl.DateTimeFormat().resolvedOptions().timeZone, 'id')).length).toBeGreaterThan(0);
    return platform;
  }

  it('without the permission the choice is saved and the channels are made, and nothing asks', async () => {
    const platform = await phoneWithAPlan();
    for (const display of ['prompt', 'denied'] as const) {
      phone.display = display;
      await changeNotifySound(platform.store, 'sound2');
      await applyNotifyChannels(platform.store);
      expect(await scheduleReminders(platform)).toBe(0);
      expect(phone.asked).toBe(0);
      expect(phone.scheduled).toHaveLength(0);
      expect(await readNotifySound(platform.store)).toBe('sound2');
      expect(sounded()).toEqual(['sulo_kabar_suara2', 'sulo_tenggat_suara2']);
    }
  });

  it('once the user allows notifications, the reminders are scheduled on the chosen sound\'s channels', async () => {
    const platform = await phoneWithAPlan();
    await changeNotifySound(platform.store, 'sound2');
    phone.display = 'granted';
    const n = await scheduleReminders(platform);
    expect(n).toBeGreaterThan(0);
    expect(phone.asked).toBe(0);
    const plan = await readChannelPlan(platform.store);
    for (const item of phone.scheduled.flat()) {
      expect(item.channelId).toBe(channelFor(plan, String(item.extra?.suloId)));
      expect(phone.channels.has(item.channelId!)).toBe(true);
    }
  });

  it('the code of this path never names the permission, and only one place in the app schedules a notification', () => {
    const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
    for (const file of ['../src/notify-sound.ts', '../android/app/src/main/java/dev/ikrar/sulo/notify/NotifyChannels.kt', '../android/app/src/main/java/dev/ikrar/sulo/notify/SuloNotifyPlugin.kt', '../../../packages/core/src/notify/channels.ts']) {
      expect(read(file), file).not.toMatch(/requestPermission|POST_NOTIFICATIONS|checkPermission/);
    }
    // Every notification of the app goes through scheduleOnChannels (platform/notifications.ts): no other file calls the plugin's schedule().
    const sources = (dir: string): string[] => readdirSync(new URL(dir, import.meta.url), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sources(`${dir}${e.name}/`) : /\.tsx?$/.test(e.name) ? [`${dir}${e.name}`] : []));
    const callers = sources('../src/').filter((f) => /LocalNotifications\s*\.\s*schedule\s*\(/.test(read(f)));
    expect(callers).toEqual(['../src/platform/notifications.ts']);
    // And the permission is still asked in one place only (P-03).
    expect(sources('../src/').filter((f) => /requestPermissions\s*\(/.test(read(f)))).toEqual(['../src/onboarding/OnboardingFlow.tsx']);
  });
});

describe('the preview', () => {
  it('the four sounds have a file to play; the phone\'s own sound and silence have none', () => {
    expect(['sound1', 'sound2', 'sound3', 'sound4'].map((s) => previewFile(s as never))).toEqual(['sounds/sulo_notif_1.mp3', 'sounds/sulo_notif_2.mp3', 'sounds/sulo_notif_3.mp3', 'sounds/sulo_notif_4.mp3']);
    expect(previewFile('device')).toBeNull();
    expect(previewFile('silent')).toBeNull();
  });

  it('what is previewed is what the channel plays: the same bytes in public/sounds and res/raw, under the names the plan uses', async () => {
    const { store } = createMobilePlatform();
    for (const n of [1, 2, 3, 4]) {
      const preview = readFileSync(new URL(`../public/sounds/sulo_notif_${n}.mp3`, import.meta.url));
      const raw = readFileSync(new URL(`../android/app/src/main/res/raw/sulo_notif_${n}.mp3`, import.meta.url));
      expect(preview.equals(raw)).toBe(true);
      expect(preview.length).toBeGreaterThan(2000);
      const plan = await changeNotifySound(store, `sound${n}` as never);
      expect(plan.channels.find((c) => c.kind === 'due')!.sound).toBe(`sulo_notif_${n}`);
    }
    // Android resource names: lower case, digits and underscores only.
    for (const name of readdirSync(new URL('../android/app/src/main/res/raw/', import.meta.url))) expect(name).toMatch(/^[a-z0-9_]+\.[a-z0-9]+$/);
  });
});
