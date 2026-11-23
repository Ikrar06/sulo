// The notification sound the user picked (Pengaturan), and the channels
// that follow from it. One choice in the store; core turns it into a channel
// plan (notify/channels.ts); the native side makes the phone match it
// (NotifyChannels.kt, the only code that creates or removes a channel). The
// app's own notifications and the background worker both get this same
// plan, so there is one answer to "which channel".
//
// Nothing here asks for the notification permission, and nothing here needs
// it: a channel can be made and a choice can be saved while notifications
// are still off, and they are used the moment the user allows them.

import { registerPlugin } from '@capacitor/core';
import { resolveLocale } from '@sulo/core/i18n';
import { mobileWords } from '@sulo/core/i18n/mobile';
import { channelPlan, DEFAULT_NOTIFY_SOUND, isNotifySound, type ChannelPlan, type NotifySound } from '@sulo/core/notify/channels';
import { readPrefs } from '@sulo/core/prefs';
import type { KeyValueStore } from '@sulo/core/types';

export const NOTIFY_SOUND_KEY = 'mobile:notifySound';

interface SuloNotifyPlugin {
  /** Brings the phone's channels to the plan (core ChannelPlan as JSON). Asks the user nothing. */
  applyChannels(options: { plan: string }): Promise<{ created: string[]; removed: string[]; channels: string[] }>;
}

export const SuloNotify = registerPlugin<SuloNotifyPlugin>('SuloNotify', {
  // pnpm mobile:web and Vitest: there are no channels in a browser.
  web: () => ({ applyChannels: async () => ({ created: [], removed: [], channels: [] }) }),
});

/** The chosen sound; a new install (or anything unreadable) has the first one. */
export async function readNotifySound(store: KeyValueStore): Promise<NotifySound> {
  const saved = await store.get<unknown>(NOTIFY_SOUND_KEY).catch(() => undefined);
  return isNotifySound(saved) ? saved : DEFAULT_NOTIFY_SOUND;
}

/** The channel plan for the saved choice, with the channels' names in the app's language. */
export async function readChannelPlan(store: KeyValueStore): Promise<ChannelPlan> {
  const [sound, prefs] = await Promise.all([readNotifySound(store), readPrefs(store)]);
  const language = typeof navigator === 'undefined' ? 'id' : navigator.language;
  return channelPlan(sound, mobileWords(resolveLocale(prefs.locale, language)).notifySound.channels);
}

/**
 * Makes the phone's channels match the saved choice and returns the plan.
 * Called before anything is scheduled, so a notification never names a
 * channel that is not there. When the native side cannot be reached the
 * plan still stands: the worker applies the same plan before it notifies.
 */
export async function applyNotifyChannels(store: KeyValueStore): Promise<ChannelPlan> {
  const plan = await readChannelPlan(store);
  await SuloNotify.applyChannels({ plan: JSON.stringify(plan) }).catch(() => undefined);
  return plan;
}

/** Saves another sound and swaps the channels: the new ones are made, the previous sound's are removed. */
export async function changeNotifySound(store: KeyValueStore, sound: NotifySound): Promise<ChannelPlan> {
  await store.set(NOTIFY_SOUND_KEY, sound);
  return applyNotifyChannels(store);
}

/** The file Pengaturan plays as a preview (the same bytes as the channel's sound), or null when there is nothing to play. */
export function previewFile(sound: NotifySound): string | null {
  const n = /^sound([1-4])$/.exec(sound)?.[1];
  return n ? `sounds/sulo_notif_${n}.mp3` : null;
}
