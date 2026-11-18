// Background-sync gates that must hold before any scheduled request.

import { JITTER_MAX_MIN, QUIET_HOURS } from './moodle/limits';
import type { Clock, KeyValueStore } from './types';

export const SYNC_ALARM = 'sync';
/** Recomputes the badge as deadlines approach. No request. */
export const BADGE_ALARM = 'badge';
export const BADGE_REFRESH_MIN = 30;

/** A background sync is skipped when data is younger than this (a popup sync just ran). */
export const BACKGROUND_FRESH_MIN = 60;

export const JITTER_KEY = 'global:jitterMinutes';

/** Stored with the range it was drawn from, so a new range re-draws it. */
export interface StoredJitter {
  minutes: number;
  /** JITTER_MAX_MIN at the time of the draw. */
  range: number;
}

/**
 * A fixed random offset per installation (0..JITTER_MAX_MIN), so installs do
 * not hit SIKOLA at the same minute. Stored once and reused; drawn again when
 * the range changed (older installs stored a bare number from 0..10).
 * `changed` tells the caller to move the periodic alarm.
 */
export async function ensureJitter(
  store: KeyValueStore,
  random: () => number = Math.random,
  range: number = JITTER_MAX_MIN,
): Promise<{ minutes: number; changed: boolean }> {
  const stored = await store.get<StoredJitter | number>(JITTER_KEY);
  if (typeof stored === 'object' && stored !== null && stored.range === range && Number.isInteger(stored.minutes)) {
    return { minutes: stored.minutes, changed: false };
  }
  const minutes = Math.min(range, Math.floor(random() * (range + 1)));
  await store.set<StoredJitter>(JITTER_KEY, { minutes, range });
  return { minutes, changed: true };
}

export async function jitterMinutes(store: KeyValueStore, random: () => number = Math.random): Promise<number> {
  return (await ensureJitter(store, random)).minutes;
}

/** Mirrors chrome.idle states without importing browser APIs. */
export type IdleState = 'active' | 'idle' | 'locked';

export function isQuietHour(
  localHour: number,
  quiet: { startHour: number; endHour: number } = QUIET_HOURS,
): boolean {
  const { startHour, endHour } = quiet;
  if (startHour === endHour) return false;
  return startHour < endHour
    ? localHour >= startHour && localHour < endHour
    : localHour >= startHour || localHour < endHour;
}

export type BackgroundBlock = 'QUIET_HOURS' | 'IDLE';

/** Background sync only runs while the user is active and outside quiet hours. */
export function backgroundBlockReason(clock: Clock, idleState: IdleState): BackgroundBlock | null {
  if (isQuietHour(clock.localHour())) return 'QUIET_HOURS';
  if (idleState !== 'active') return 'IDLE';
  return null;
}
