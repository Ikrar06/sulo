// The mascot's mood on Ringkasan (the Android app and the dashboard): one
// expression for the state of things, in this order of priority:
//   0. a sync is running: syncing (busy)
//   1. SIKOLA asks to sign in again: sleepy (the only time it sleeps)
//   2. no connection: stale (the data may be old)
//   3. a task is overdue: urgent (worried, wide eyes)
//   4. a deadline within 24 hours: idle, alert (keen)
//   5. no deadline in the next 7 days: all-done (happy)
//   6. otherwise: idle
// Pure; the screen adds short reactions on top (a tap, a refresh, a task done).
// Below it: the mascot's thirteen expressions by name, which of them each
// state of the app shows, and the onboarding's named expressions.

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
  /** Something is due within a day: the keen look. */
  alert: boolean;
}

const DAY = 86_400;

export function mascotMood({ now, dueTimes, sessionExpired, offline, syncing = false }: MoodInput): Mood {
  if (syncing) return { state: 'syncing', alert: false };
  if (sessionExpired) return { state: 'sleepy', alert: false };
  if (offline) return { state: 'stale', alert: false };
  if (dueTimes.some((t) => t < now)) return { state: 'urgent', alert: false };
  if (dueTimes.some((t) => t - now < DAY)) return { state: 'idle', alert: true };
  if (!dueTimes.some((t) => t - now < 7 * DAY)) return { state: 'all-done', alert: false };
  return { state: 'idle', alert: false };
}

/**
 * The mascot's expressions (owner's decision, 23 Nov 2026). Each has its own
 * stance and its own eyes; the component (packages/ui/src/mascot) draws them.
 */
export const MASCOT_MOODS = ['neutral', 'happy', 'proud', 'busy', 'keen', 'worried', 'sad', 'sleepy', 'stale', 'surprised', 'wink', 'celebrate', 'dizzy'] as const;
export type MascotMood = (typeof MASCOT_MOODS)[number];

/**
 * Which expression a state of the app shows. `alert` (a deadline within a
 * day) turns the plain idle look into the keen one. Sleepy is kept for an
 * ended session; no connection and old data are stale.
 */
export function moodFor(state: MascotState, alert = false): MascotMood {
  switch (state) {
    case 'idle':
      return alert ? 'keen' : 'neutral';
    case 'syncing':
      return 'busy';
    case 'all-done':
      return 'happy';
    case 'celebrate':
      return 'celebrate';
    case 'urgent':
      return 'worried';
    case 'sleepy':
      return 'sleepy';
    case 'stale':
      return 'stale';
    case 'dizzy':
      return 'dizzy';
    case 'onboarding':
      return 'neutral';
  }
}

/**
 * The onboarding's named expressions (M8c.2): the expression and, for some,
 * where it looks (-1..1 of the eyes' travel; x right, y down). The four
 * looks are the neutral expression with a gaze. The component blinks on its own.
 */
export interface MascotExpressionSpec {
  mood: MascotMood;
  look?: { x: number; y: number };
}

export const MASCOT_EXPRESSIONS = {
  neutral: { mood: 'neutral' },
  happy: { mood: 'happy' },
  lookUp: { mood: 'neutral', look: { x: 0, y: -1 } },
  lookLeft: { mood: 'neutral', look: { x: -1, y: 0 } },
  lookRight: { mood: 'neutral', look: { x: 1, y: 0 } },
  lookDown: { mood: 'neutral', look: { x: 0, y: 1 } },
  proud: { mood: 'proud' },
  busy: { mood: 'busy' },
  sad: { mood: 'sad' },
  celebrate: { mood: 'celebrate' },
  wink: { mood: 'wink' },
  surprised: { mood: 'surprised' },
} as const satisfies Record<string, MascotExpressionSpec>;

export type MascotExpression = keyof typeof MASCOT_EXPRESSIONS;
export const MASCOT_EXPRESSION_NAMES = Object.keys(MASCOT_EXPRESSIONS) as MascotExpression[];
