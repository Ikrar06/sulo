// Background-sync gates that must hold before any scheduled request.
// M1 ships only the pure predicates and their tests; alarms, jitter and the
// sync loop that use them arrive in M2.

import { QUIET_HOURS } from './moodle/limits';
import type { Clock } from './types';

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
