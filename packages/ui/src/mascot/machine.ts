// Which expression the mascot shows, as a state machine with no DOM: the
// expression the app asks for, the reaction in flight (if any), and the face
// actually drawn, which a reaction may borrow for a while (star eyes while
// celebrating, a glad squint after a tick). `reduce` returns the next state
// and what has to happen on screen; the rig does it.

import { eyeChange, type EyeChange, type Mood } from './moods';
import type { PlayedReaction, ReactionName } from './motion';

/** One timed change of the face during a reaction (seconds from its start); `null` gives the face back. */
export interface FaceCue {
  readonly at: number;
  readonly face: Mood | null;
}

/** A burst of flat stars from the body. */
export interface Burst {
  /** Seconds from the reaction's start. */
  readonly at: number;
  readonly count: number;
  /** 1 is the celebration's full burst; smaller flies less far with smaller stars. */
  readonly power: number;
}

export interface ReactionSpec {
  /** Seconds until the reaction is over and the face is the app's again. */
  readonly duration: number;
  readonly cues: readonly FaceCue[];
  /** A higher rank may interrupt a lower or equal one; a lower one is ignored while a higher runs. */
  readonly rank: number;
  readonly bursts?: readonly Burst[];
  /** Blinks, seconds from the start. */
  readonly blinks?: readonly number[];
  /** Where the eyes look for the reaction's length (-1..1), or null to leave them. */
  readonly look?: { readonly x: number; readonly y: number; readonly from: number; readonly to: number };
  /** A tint of the flame for the reaction's length, inside the palette. */
  readonly tint?: 'bright' | 'hot' | 'dim';
}

// Star eyes for the two jumps (as the old mascot did: 2.75 s), a glad squint after (2 s), then back to whatever
// the app shows. Stars burst as it leaves the ground, and again, smaller, on the second jump.
const PARTY: ReactionSpec = {
  duration: 4.75,
  rank: 3,
  cues: [{ at: 0, face: 'celebrate' }, { at: 2.75, face: 'happy' }, { at: 4.75, face: null }],
  bursts: [{ at: 0.1, count: 10, power: 1 }, { at: 0.9, count: 6, power: 0.7 }],
  tint: 'bright',
};

/**
 * A ticked task gets its hop and its stars. Ticks that follow soon get the
 * hop alone: a run of ticks is one small cheer, not a shower of stars. The
 * stars come back once this many seconds have passed without a tick. The
 * full celebration is kept for the last task (allClear).
 */
export const CHECK_QUIET = 6;

export const REACTIONS: Record<PlayedReaction, ReactionSpec> = {
  tap: { duration: 1.05, rank: 1, cues: [], blinks: [0.04] },
  jump: { duration: 1.75, rank: 1, cues: [] },
  celebrate: PARTY,
  allClear: PARTY,
  startle: { duration: 1.4, rank: 2, cues: [{ at: 0, face: 'surprised' }, { at: 1, face: null }] },
  sag: { duration: 2.6, rank: 2, cues: [{ at: 0.15, face: 'sad' }, { at: 2.1, face: null }], look: { x: 0, y: 0.8, from: 0.2, to: 2.1 }, tint: 'dim' },
  done: { duration: 1.6, rank: 1, cues: [{ at: 0.08, face: 'happy' }, { at: 1.4, face: null }], bursts: [{ at: 0.2, count: 6, power: 0.8 }] },
  fail: { duration: 2, rank: 2, cues: [{ at: 0.05, face: 'sad' }, { at: 1.75, face: null }], tint: 'dim' },
  checked: { duration: 1.4, rank: 1, cues: [{ at: 0.04, face: 'happy' }, { at: 1.2, face: null }], bursts: [{ at: 0.12, count: 6, power: 0.8 }] },
  checkedAgain: { duration: 1.4, rank: 1, cues: [{ at: 0.04, face: 'happy' }, { at: 1.2, face: null }] },
  incoming: { duration: 1.3, rank: 1, cues: [{ at: 0.05, face: 'keen' }, { at: 1.1, face: null }], blinks: [0.5, 0.72] },
  near: { duration: 1.25, rank: 1, cues: [{ at: 0.02, face: 'worried' }, { at: 1.1, face: null }], look: { x: 0, y: 0.7, from: 0.1, to: 1.1 }, tint: 'hot' },
};

export interface MachineState {
  /** What the app asks for. */
  readonly mood: Mood;
  /** What the face shows now. */
  readonly face: Mood;
  /** The reaction in flight, with a serial so late cues of an interrupted one are ignored. */
  readonly reaction: { readonly name: PlayedReaction; readonly id: number } | null;
  readonly serial: number;
  /** When the last ticked task was cheered (clock seconds), or null: see CHECK_QUIET. */
  readonly checkedAt: number | null;
}

export type MachineEvent =
  | { readonly type: 'mood'; readonly mood: Mood }
  | { readonly type: 'react'; readonly name: ReactionName; readonly now: number }
  /** A reaction's timed cue came due. */
  | { readonly type: 'cue'; readonly id: number; readonly face: Mood | null }
  | { readonly type: 'end'; readonly id: number };

export type Effect =
  /** The body moves to another stance. */
  | { readonly type: 'stance'; readonly to: Mood }
  /** The face changes, blended or through a blink. */
  | { readonly type: 'face'; readonly from: Mood; readonly to: Mood; readonly via: EyeChange }
  | { readonly type: 'start'; readonly name: PlayedReaction; readonly id: number }
  /** A running reaction was cut short: its sparks and cues are dropped. */
  | { readonly type: 'cancel'; readonly id: number };

export const initialState = (mood: Mood): MachineState => ({ mood, face: mood, reaction: null, serial: 0, checkedAt: null });

const face = (from: Mood, to: Mood): Effect[] => (from === to ? [] : [{ type: 'face', from, to, via: eyeChange(from, to) }]);

export function reduce(state: MachineState, event: MachineEvent): { state: MachineState; effects: Effect[] } {
  switch (event.type) {
    case 'mood': {
      if (event.mood === state.mood) return { state, effects: [] };
      // The body always goes to the new stance. The face follows unless a reaction has borrowed it.
      const borrowed = state.reaction !== null && state.face !== state.mood;
      const next = { ...state, mood: event.mood, face: borrowed ? state.face : event.mood };
      return { state: next, effects: [{ type: 'stance', to: event.mood }, ...(borrowed ? [] : face(state.face, event.mood))] };
    }
    case 'react': {
      const again = event.name === 'checked' && state.checkedAt !== null && event.now - state.checkedAt < CHECK_QUIET;
      const name: PlayedReaction = again ? 'checkedAgain' : event.name;
      const spec = REACTIONS[name];
      const running = state.reaction;
      if (running && REACTIONS[running.name].rank > spec.rank) return { state, effects: [] };
      const id = state.serial + 1;
      const effects: Effect[] = running ? [{ type: 'cancel', id: running.id }] : [];
      // An interrupted reaction gives the face back before the new one takes it.
      const cleared = running && state.face !== state.mood ? face(state.face, state.mood) : [];
      // Every tick that is cheered pushes the quiet time on: the stars wait for a pause.
      const checkedAt = event.name === 'checked' ? event.now : state.checkedAt;
      return { state: { ...state, face: state.mood, reaction: { name, id }, serial: id, checkedAt }, effects: [...effects, ...cleared, { type: 'start', name, id }] };
    }
    case 'cue': {
      if (!state.reaction || state.reaction.id !== event.id) return { state, effects: [] };
      const to = event.face ?? state.mood;
      return { state: { ...state, face: to }, effects: face(state.face, to) };
    }
    case 'end': {
      if (!state.reaction || state.reaction.id !== event.id) return { state, effects: [] };
      return { state: { ...state, face: state.mood, reaction: null }, effects: face(state.face, state.mood) };
    }
  }
}
