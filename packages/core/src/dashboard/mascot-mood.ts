// The mascot's mood on the Android app's Ringkasan (M8c.1): one expression
// for the state of things, in this order of priority:
//   0. a sync is running: syncing (busy)
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
  /** A sync is running: busy (owner's rules, 20 Nov 2026). */
  syncing?: boolean;
}

export interface Mood {
  state: MascotState;
  /** Blinks more often: something is due within a day. */
  alert: boolean;
}

const DAY = 86_400;

export function mascotMood({ now, dueTimes, sessionExpired, offline, syncing = false }: MoodInput): Mood {
  if (syncing) return { state: 'syncing', alert: false };
  if (sessionExpired || offline) return { state: 'sleepy', alert: false };
  if (dueTimes.some((t) => t < now)) return { state: 'urgent', alert: false };
  if (dueTimes.some((t) => t - now < DAY)) return { state: 'idle', alert: true };
  if (!dueTimes.some((t) => t - now < 7 * DAY)) return { state: 'all-done', alert: false };
  return { state: 'idle', alert: false };
}

/**
 * The mascot's named expressions (M8c.2), for any screen: which state draws
 * it (eyes, flame colors, idle motion), an optional variant on top (a tilt of
 * the eyes, one eye closed, a smaller flame), and where it looks (-1..1 of
 * the eyes' travel; x right, y down). The component blinks on its own.
 */
export type MascotVariant = 'sad' | 'proud' | 'wink' | 'surprised' | 'busy';

export interface MascotExpressionSpec {
  state: MascotState;
  variant?: MascotVariant;
  look?: { x: number; y: number };
}

export const MASCOT_EXPRESSIONS = {
  neutral: { state: 'onboarding' },
  happy: { state: 'all-done' },
  lookUp: { state: 'onboarding', look: { x: 0, y: -1 } },
  lookLeft: { state: 'onboarding', look: { x: -1, y: 0 } },
  lookRight: { state: 'onboarding', look: { x: 1, y: 0 } },
  lookDown: { state: 'onboarding', look: { x: 0, y: 1 } },
  proud: { state: 'all-done', variant: 'proud' },
  busy: { state: 'syncing', variant: 'busy' },
  sad: { state: 'onboarding', variant: 'sad', look: { x: 0, y: 0.8 } },
  celebrate: { state: 'celebrate' },
  wink: { state: 'onboarding', variant: 'wink' },
  surprised: { state: 'urgent', variant: 'surprised', look: { x: 0, y: 0 } },
} as const satisfies Record<string, MascotExpressionSpec>;

export type MascotExpression = keyof typeof MASCOT_EXPRESSIONS;
export const MASCOT_EXPRESSION_NAMES = Object.keys(MASCOT_EXPRESSIONS) as MascotExpression[];
