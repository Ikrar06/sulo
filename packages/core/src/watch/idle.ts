// "Lama tidak dibuka" (1.1.0, docs/mkpk/RENCANA-RINCI.md M7): after 7 days
// without Sulo being opened, everything that keeps a connection alive stops
// with one notification (SIKOLA's watch, Sipakamase's keeper); opening Sulo
// again starts the watch again, while Sipakamase asks to connect again.
// One marker per platform. Pure, plus two small store helpers.

import type { KeyValueStore, UnixSeconds } from '../types';

export const LAST_OPEN_KEY = 'global:lastOpenedAt';
export const IDLE_PAUSE_KEY = 'global:idlePausedAt';
export const IDLE_DAYS = 7;
const IDLE_SEC = IDLE_DAYS * 86_400;

/** Not opened for 7 days or more (exactly 7 counts). Never before a first open is known. */
export const idleTooLong = (lastOpenedAt: UnixSeconds | null, now: UnixSeconds): boolean => lastOpenedAt !== null && now - lastOpenedAt >= IDLE_SEC;

/** Sulo was opened: the marker moves and a pause ends. Returns the previous open (null: first). */
export async function markOpened(store: KeyValueStore, now: UnixSeconds): Promise<UnixSeconds | null> {
  const prev = (await store.get<number>(LAST_OPEN_KEY)) ?? null;
  await store.set(LAST_OPEN_KEY, now);
  if ((await store.get(IDLE_PAUSE_KEY)) !== undefined) await store.remove(IDLE_PAUSE_KEY);
  return prev;
}

export const readIdlePause = async (store: KeyValueStore): Promise<UnixSeconds | null> => (await store.get<number>(IDLE_PAUSE_KEY)) ?? null;

/** The background's daily look: pauses once (true the first time), when 7 days passed. */
export async function pauseIfIdle(store: KeyValueStore, now: UnixSeconds): Promise<boolean> {
  if ((await readIdlePause(store)) !== null) return false;
  if (!idleTooLong((await store.get<number>(LAST_OPEN_KEY)) ?? null, now)) return false;
  await store.set(IDLE_PAUSE_KEY, now);
  return true;
}
