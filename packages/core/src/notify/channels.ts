// The Android app's notification channels, as data (owner's rules, 23 Nov
// 2026). On Android a channel's sound cannot be changed once the channel
// exists, so the chosen sound is part of the channel's id: picking another
// sound makes new channels and removes the old ones, and the phone's
// settings never fill up with dead channels.
//
// One choice, one plan, two readers: the app (local notifications it
// schedules itself) and the background worker (through the watch plan) both
// get the plan built here, and one piece of native code
// (NotifyChannels.kt) is the only thing that creates or removes a channel.
// The same rules run in Kotlin; both sides are tested on the same vectors
// (notify/channel-vectors.json), so CI fails when they disagree.
// Pure: no platform code.

/** What the user can pick in Pengaturan. */
export const NOTIFY_SOUNDS = ['sound1', 'sound2', 'sound3', 'sound4', 'device', 'silent'] as const;
export type NotifySound = (typeof NOTIFY_SOUNDS)[number];
/** A new install starts with this one. */
export const DEFAULT_NOTIFY_SOUND: NotifySound = 'sound1';

export const isNotifySound = (v: unknown): v is NotifySound => typeof v === 'string' && (NOTIFY_SOUNDS as readonly string[]).includes(v);

/**
 * The kinds of notification, each with a channel of its own:
 *   due      reminders of deadlines (tasks, the academic calendar, KRS)       follows the chosen sound
 *   news     new tasks and updates found by background watching               follows the chosen sound
 *   morning  the morning summary                                              always silent
 *   session  "sign in to SIKOLA again"                                        always silent
 *   paused   background watching has stopped by itself                        always silent
 *   release  a new version (no such notification is sent yet)                 always silent
 */
export const CHANNEL_KINDS = ['due', 'news', 'morning', 'session', 'paused', 'release'] as const;
export type ChannelKind = (typeof CHANNEL_KINDS)[number];

/** The kinds whose channel carries the chosen sound. */
const SOUNDED: readonly ChannelKind[] = ['due', 'news'];
/** Kinds with no notification of their own yet: named in the plan, not created on the phone. */
const RESERVED: readonly ChannelKind[] = ['release'];

/** The part of a channel's id that names its kind. */
const ID_OF: Record<ChannelKind, string> = { due: 'sulo_tenggat', news: 'sulo_kabar', morning: 'sulo_pagi', session: 'sulo_sesi', paused: 'sulo_jeda', release: 'sulo_versi' };
/** The part that names the sound, and the file in res/raw it plays ("default": the phone's own sound; null: none). */
const SOUND_OF: Record<NotifySound, { tag: string; raw: string | null }> = {
  sound1: { tag: 'suara1', raw: 'sulo_notif_1' },
  sound2: { tag: 'suara2', raw: 'sulo_notif_2' },
  sound3: { tag: 'suara3', raw: 'sulo_notif_3' },
  sound4: { tag: 'suara4', raw: 'sulo_notif_4' },
  device: { tag: 'bawaan', raw: 'default' },
  silent: { tag: 'senyap', raw: null },
};

/** Every id that begins like this is Sulo's own, and goes when the plan no longer names it. */
export const CHANNEL_PREFIX = 'sulo_';
/** Channels of earlier versions that are not Sulo's by prefix: the local notifications plugin's catch-all. */
export const LEGACY_CHANNELS: readonly string[] = ['default'];

export interface ChannelSpec {
  id: string;
  kind: ChannelKind;
  /** As the phone's settings show it. */
  name: string;
  /** A file in res/raw (no extension), "default" for the phone's own sound, null for none. */
  sound: string | null;
  /** "default" makes a sound; "low" never does (and does not vibrate). */
  importance: 'default' | 'low';
}

export interface ChannelPlan {
  version: 1;
  /** The choice the plan was built from. */
  sound: NotifySound;
  /** The channels that exist on the phone under this plan. Anything else of Sulo's is removed. */
  channels: ChannelSpec[];
  /** The channel each kind of notification goes to. */
  byKind: Record<ChannelKind, string>;
}

export type ChannelNames = Record<ChannelKind, string>;

/** The plan for a choice of sound. */
export function channelPlan(sound: NotifySound, names: ChannelNames): ChannelPlan {
  const chosen = SOUND_OF[sound];
  const spec = (kind: ChannelKind): ChannelSpec => {
    const sounded = SOUNDED.includes(kind);
    return {
      id: sounded ? `${ID_OF[kind]}_${chosen.tag}` : ID_OF[kind],
      kind,
      name: names[kind],
      sound: sounded ? chosen.raw : null,
      // A channel with no sound is a quiet one in every way: low importance never sounds or vibrates.
      importance: sounded && chosen.raw !== null ? 'default' : 'low',
    };
  };
  const all = CHANNEL_KINDS.map(spec);
  return {
    version: 1,
    sound,
    channels: all.filter((c) => !RESERVED.includes(c.kind)),
    byKind: Object.fromEntries(all.map((c) => [c.kind, c.id])) as Record<ChannelKind, string>,
  };
}

/**
 * Which kind a notification is, from its id (reminders/run.ts
 * notificationId, and the worker's own ids). Unknown ids are reminders.
 */
export function channelKindOf(notificationId: string): ChannelKind {
  const kind = notificationId.split('|')[0] ?? '';
  if (kind === 'changes' || kind === 'changes_summary') return 'news';
  if (kind === 'morning') return 'morning';
  if (kind === 'session') return 'session';
  // The worker's "watching has stopped" notice: watch|paused:<time>.
  if (kind === 'watch') return 'paused';
  if (kind === 'release') return 'release';
  return 'due';
}

/** The channel a notification goes to under a plan. */
export const channelFor = (plan: ChannelPlan, notificationId: string): string => plan.byKind[channelKindOf(notificationId)];

export interface ChannelChanges {
  create: ChannelSpec[];
  remove: string[];
}

/**
 * What to do on a phone that has `existing` channels: make the plan's
 * channels that are missing, and remove every other channel of Sulo's (the
 * previous sound's, and those of earlier versions). A channel that already
 * exists is left alone, whatever the user has since set for it in the
 * phone's settings.
 */
export function channelChanges(existing: readonly string[], plan: ChannelPlan): ChannelChanges {
  const wanted = new Set(plan.channels.map((c) => c.id));
  const have = new Set(existing);
  return {
    create: plan.channels.filter((c) => !have.has(c.id)),
    remove: [...have].filter((id) => !wanted.has(id) && (id.startsWith(CHANNEL_PREFIX) || LEGACY_CHANNELS.includes(id))).sort(),
  };
}
