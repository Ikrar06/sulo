// The Android app's notification channels (core notify/channels.ts): the
// plan for each choice of sound, which channel each notification goes to,
// and what changes on a phone when the choice changes. The Kotlin side
// (NotifyChannelsTest.kt) reads the same notify/channel-vectors.json, so CI
// fails when the two disagree. Run with UPDATE_CHANNEL_VECTORS=1 to rewrite
// the file after a deliberate change, then check the diff by hand.
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHANNEL_KINDS, channelChanges, channelFor, channelKindOf, channelPlan, DEFAULT_NOTIFY_SOUND, isNotifySound, NOTIFY_SOUNDS, type ChannelNames, type NotifySound } from '@sulo/core/notify/channels';
import { mobileWords } from '@sulo/core/i18n/mobile';
import { notificationId } from '@sulo/core/reminders/run';

const FILE = new URL('../../../packages/core/src/notify/channel-vectors.json', import.meta.url);
const NAMES: ChannelNames = { due: 'Pengingat tenggat', news: 'Tugas dan kabar baru', morning: 'Ringkasan pagi', session: 'Masuk lagi ke SIKOLA', paused: 'Pemantauan dijeda', release: 'Versi baru' };
const plan = (sound: NotifySound) => channelPlan(sound, NAMES);

const IDS = ['task|101|t:101:h1', 'summary|s:1795000000', 'calendar|c:uts:h7', 'krs|k:h1', 'changes|task:101:added', 'changes|course:11|c:1', 'changes_summary|cs:1', 'morning|m:2026-11-23', 'session|s:1', 'session|watch:1795000000', 'watch|paused:1795000000', 'release|42', 'something-else', ''];
/** What a phone may hold before a change: nothing, an earlier version's channels, a previous choice, someone else's channels. */
const EXISTING: { existing: string[]; sound: NotifySound }[] = [
  { existing: [], sound: 'sound1' },
  { existing: ['default', 'sulo_kabar'], sound: 'sound1' },
  { existing: ['default', 'sulo_tenggat_suara1', 'sulo_kabar_suara1', 'sulo_pagi', 'sulo_sesi', 'sulo_jeda'], sound: 'sound1' },
  { existing: ['sulo_tenggat_suara1', 'sulo_kabar_suara1', 'sulo_pagi', 'sulo_sesi', 'sulo_jeda'], sound: 'sound3' },
  { existing: ['sulo_tenggat_suara3', 'sulo_kabar_suara3', 'sulo_pagi', 'sulo_sesi', 'sulo_jeda'], sound: 'device' },
  { existing: ['sulo_tenggat_bawaan', 'sulo_kabar_bawaan', 'sulo_pagi', 'sulo_sesi', 'sulo_jeda'], sound: 'silent' },
  { existing: ['sulo_tenggat_senyap', 'sulo_kabar_senyap', 'sulo_pagi', 'sulo_sesi', 'sulo_jeda'], sound: 'sound2' },
  // A change that was cut short: both sounds' channels are there.
  { existing: ['sulo_tenggat_suara1', 'sulo_kabar_suara2', 'sulo_tenggat_suara2', 'sulo_pagi'], sound: 'sound2' },
  // Channels that are not Sulo's are never touched.
  { existing: ['miscellaneous', 'sound_chime', 'sulo_tenggat_suara4', 'sulo_kabar_suara4', 'sulo_pagi', 'sulo_sesi', 'sulo_jeda', 'sulo_versi'], sound: 'sound4' },
];

const built = {
  names: NAMES,
  plans: NOTIFY_SOUNDS.map((sound) => ({ sound, out: plan(sound) })),
  kinds: IDS.map((id) => ({ id, out: channelKindOf(id) })),
  changes: EXISTING.map(({ existing, sound }) => {
    const c = channelChanges(existing, plan(sound));
    return { existing, plan: plan(sound), out: { create: c.create.map((s) => s.id), remove: c.remove } };
  }),
};

describe('the shared channel vectors', () => {
  it('are what core produces (the Kotlin side reads the same file)', () => {
    if (process.env.UPDATE_CHANNEL_VECTORS) writeFileSync(FILE, `${JSON.stringify(built, null, 1)}\n`);
    expect(JSON.parse(readFileSync(FILE, 'utf8'))).toEqual(JSON.parse(JSON.stringify(built)));
  });
});

describe('the channel plan', () => {
  it('a new install starts with the first sound', () => {
    expect(DEFAULT_NOTIFY_SOUND).toBe('sound1');
    expect(NOTIFY_SOUNDS).toEqual(['sound1', 'sound2', 'sound3', 'sound4', 'device', 'silent']);
    expect(isNotifySound('sound3')).toBe(true);
    for (const bad of ['sound5', '', null, 3, undefined]) expect(isNotifySound(bad)).toBe(false);
  });

  it('only reminders and news follow the chosen sound, and their channel ids carry it', () => {
    const p = plan('sound2');
    expect(p.byKind.due).toBe('sulo_tenggat_suara2');
    expect(p.byKind.news).toBe('sulo_kabar_suara2');
    const by = Object.fromEntries(p.channels.map((c) => [c.kind, c]));
    expect(by.due).toMatchObject({ sound: 'sulo_notif_2', importance: 'default', name: 'Pengingat tenggat' });
    expect(by.news).toMatchObject({ sound: 'sulo_notif_2', importance: 'default', name: 'Tugas dan kabar baru' });
    // Every sound has ids of its own: no two choices share a channel.
    const ids = NOTIFY_SOUNDS.flatMap((s) => [plan(s).byKind.due, plan(s).byKind.news]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the morning summary, the sign-in notice and the paused notice are silent whatever is chosen, on the same channels', () => {
    for (const sound of NOTIFY_SOUNDS) {
      const p = plan(sound);
      for (const kind of ['morning', 'session', 'paused'] as const) {
        const c = p.channels.find((x) => x.kind === kind)!;
        expect(c).toMatchObject({ sound: null, importance: 'low' });
        expect(c.id).toBe(plan('sound1').byKind[kind]);
      }
    }
  });

  it('the phone\'s own sound and silence are choices like the others', () => {
    const device = plan('device').channels.filter((c) => c.kind === 'due' || c.kind === 'news');
    expect(device.map((c) => c.sound)).toEqual(['default', 'default']);
    expect(device.map((c) => c.importance)).toEqual(['default', 'default']);
    const silent = plan('silent').channels.filter((c) => c.kind === 'due' || c.kind === 'news');
    expect(silent.map((c) => c.sound)).toEqual([null, null]);
    expect(silent.map((c) => c.importance)).toEqual(['low', 'low']);
    expect(silent.map((c) => c.id)).toEqual(['sulo_tenggat_senyap', 'sulo_kabar_senyap']);
  });

  it('a kind with no notification yet has a channel id but no channel on the phone', () => {
    const p = plan('sound1');
    expect(p.byKind.release).toBe('sulo_versi');
    expect(p.channels.map((c) => c.kind)).toEqual(['due', 'news', 'morning', 'session', 'paused']);
    expect(Object.keys(p.byKind).sort()).toEqual([...CHANNEL_KINDS].sort());
  });
});

describe('which channel a notification goes to', () => {
  it('follows the kind in its id, for the planner\'s ids and the worker\'s', () => {
    expect(channelKindOf(notificationId({ kind: 'task', key: 't:7:h1', task: { eventId: 7 } as never, snoozed: false }))).toBe('due');
    expect(channelKindOf(notificationId({ kind: 'summary', key: 's:1', count: 3, nearest: {} as never }))).toBe('due');
    expect(channelKindOf(notificationId({ kind: 'morning', key: 'm:1', today: 1, week: 2, nearest: {} as never }))).toBe('morning');
    expect(channelKindOf(notificationId({ kind: 'session', key: 's:1', repeat: false }))).toBe('session');
    expect(channelKindOf(notificationId({ kind: 'changes_summary', key: 'c:1', count: 4, courses: 4 }))).toBe('news');
    // The worker's own ids (WatchWorker.kt).
    expect(channelKindOf('session|watch:1795000000')).toBe('session');
    expect(channelKindOf('watch|paused:1795000000')).toBe('paused');
    expect(channelFor(plan('sound4'), 'changes|task:101:added')).toBe('sulo_kabar_suara4');
    expect(channelFor(plan('sound4'), 'task|101|t:101:h1')).toBe('sulo_tenggat_suara4');
    expect(channelFor(plan('sound4'), 'morning|m:1')).toBe('sulo_pagi');
  });
});

describe('what changes on the phone', () => {
  it('a first run makes the five channels and removes nothing', () => {
    const c = channelChanges([], plan('sound1'));
    expect(c.create.map((s) => s.id)).toEqual(['sulo_tenggat_suara1', 'sulo_kabar_suara1', 'sulo_pagi', 'sulo_sesi', 'sulo_jeda']);
    expect(c.remove).toEqual([]);
  });

  it('an earlier version\'s channels are moved over: the worker\'s single channel and the plugin\'s catch-all go', () => {
    const c = channelChanges(['default', 'sulo_kabar'], plan('sound1'));
    expect(c.remove).toEqual(['default', 'sulo_kabar']);
    expect(c.create).toHaveLength(5);
  });

  it('another sound makes two new channels and removes the two old ones: one channel per kind, always', () => {
    let have = ['sulo_tenggat_suara1', 'sulo_kabar_suara1', 'sulo_pagi', 'sulo_sesi', 'sulo_jeda'];
    for (const sound of ['sound3', 'device', 'silent', 'sound2', 'sound1'] as const) {
      const p = plan(sound);
      const c = channelChanges(have, p);
      expect(c.create.map((s) => s.kind)).toEqual(['due', 'news']);
      expect(c.remove).toHaveLength(2);
      have = [...have.filter((id) => !c.remove.includes(id)), ...c.create.map((s) => s.id)];
      expect([...have].sort()).toEqual(p.channels.map((s) => s.id).sort());
    }
  });

  it('the same choice again changes nothing, and channels that are not Sulo\'s are never touched', () => {
    const p = plan('sound4');
    expect(channelChanges(p.channels.map((c) => c.id), p)).toEqual({ create: [], remove: [] });
    expect(channelChanges(['miscellaneous', 'sound_chime', ...p.channels.map((c) => c.id)], p)).toEqual({ create: [], remove: [] });
  });
});

describe('the names', () => {
  it('both languages name every channel', () => {
    for (const locale of ['id', 'en'] as const) {
      const names = mobileWords(locale).notifySound.channels;
      for (const kind of CHANNEL_KINDS) expect(names[kind].length, `${locale} ${kind}`).toBeGreaterThan(3);
    }
    expect(mobileWords('id').notifySound.channels).toEqual(NAMES);
  });
});
