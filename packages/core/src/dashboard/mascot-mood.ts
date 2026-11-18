// The mascot's mood on the Android app's Ringkasan (M8c.1): one expression
// for the state of things, in this order of priority:
//   1. the session ended or the phone is offline: sleepy (the data may be old)
//   2. a task is overdue: urgent (worried, wide eyes)
//   3. a deadline within 24 hours: idle, alert (blinks more often)
//   4. no deadline in the next 7 days: all-done (happy)
//   5. otherwise: idle
// Pure; the screen adds short reactions on top (a tap, a refresh, a task done).

import type { MascotState } from '../view/popup-view';
import type { UnixSeconds } from '../types';

export interface MoodInput {
  now: UnixSeconds;
  /** Due times of the pending tasks (undated ones left out). */
  dueTimes: readonly UnixSeconds[];
  sessionExpired: boolean;
  offline: boolean;
}

export interface Mood {
  state: MascotState;
  /** Blinks more often: something is due within a day. */
  alert: boolean;
}

const DAY = 86_400;

export function mascotMood({ now, dueTimes, sessionExpired, offline }: MoodInput): Mood {
  if (sessionExpired || offline) return { state: 'sleepy', alert: false };
  if (dueTimes.some((t) => t < now)) return { state: 'urgent', alert: false };
  if (dueTimes.some((t) => t - now < DAY)) return { state: 'idle', alert: true };
  if (!dueTimes.some((t) => t - now < 7 * DAY)) return { state: 'all-done', alert: false };
  return { state: 'idle', alert: false };
}
