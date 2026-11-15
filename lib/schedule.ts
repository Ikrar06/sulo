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

/**
 * A fixed random offset per installation (0..JITTER_MAX_MIN), so installs do
 * not hit SIKOLA at the same minute. Stored once and reused.
 */
export async function jitterMinutes(store: KeyValueStore, random: () => number = Math.random): Promise<number> {
  const stored = await store.get<number>(JITTER_KEY);
  if (typeof stored === 'number') return stored;
  const value = Math.floor(random() * (JITTER_MAX_MIN + 1));
  await store.set(JITTER_KEY, value);
  return value;
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
