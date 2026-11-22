// The mascot's expressions: for each one, how the body stands (its
// silhouette), what the eyes are, where they rest, and how it idles. An
// expression must be told from the others by silhouette and eyes alone, at
// 24 px too, so no two share both. Pure data: no DOM.

import { EYE, type Eyes } from './eyes';
import { REST, type Pose } from './warp';

export type Mood =
  | 'neutral'
  | 'happy'
  | 'proud'
  | 'busy'
  | 'keen'
  | 'worried'
  | 'sad'
  | 'sleepy'
  | 'stale'
  | 'surprised'
  | 'wink'
  | 'celebrate'
  | 'dizzy';

export const MOODS: readonly Mood[] = ['neutral', 'happy', 'proud', 'busy', 'keen', 'worried', 'sad', 'sleepy', 'stale', 'surprised', 'wink', 'celebrate', 'dizzy'];

/** How an expression idles. Sizes are fractions of the frame's height; periods are seconds. */
export interface Idle {
  /** How far the body sways, and the tip's extra. 0 stands still. */
  readonly sway: number;
  /** Faster (above 1) or slower sway and flicker. */
  readonly pace: number;
  /** How deep it breathes: the flame above the chin rises by this much of its height at the top of a breath. */
  readonly breath: number;
  /** Seconds per breath. */
  readonly breathEvery: number;
  /** The ripple that runs up the flame. */
  readonly flicker: number;
  /** A small bounce in place now and then (seconds between; 0 for never). */
  readonly bounceEvery: number;
  /** A side-to-side rock about the base, in degrees (dizzy). */
  readonly rock: number;
  /** Seconds between blinks, shortest and longest; null never blinks (eyes that are closed or drawn). */
  readonly blink: readonly [number, number] | null;
  /** Small looks around on its own. */
  readonly glances: boolean;
  /** The eyes sweep left and right (working). */
  readonly scan: boolean;
  /** The eyes bob gently (smiling eyes, which do not blink). */
  readonly bob: boolean;
  /** A short shiver now and then (seconds between; 0 for never). */
  readonly shiverEvery: number;
}

const CALM: Idle = { sway: 0.03, pace: 1, breath: 0.026, breathEvery: 3.9, flicker: 0.011, bounceEvery: 0, rock: 0, blink: [2.8, 6], glances: true, scan: false, bob: false, shiverEvery: 0 };

export interface MoodSpec {
  /** The body's stance. */
  readonly pose: Pose;
  readonly eyes: Eyes;
  /** Where the eyes rest, -1..1 of their travel (x right, y down). */
  readonly look: { readonly x: number; readonly y: number };
  readonly idle: Idle;
  /** What it gives off while it idles, when there is room for effects: a "z" at a time asleep, stars circling when dizzy. No round particles anywhere (the owner's rule). */
  readonly drift: 'none' | 'z' | 'orbit';
  /**
   * Eyes that are drawings of their own, shown in place of the pair: the brand's star eyes (spinning) and the
   * spiral eyes. They cannot be blended into; the change goes through a blink (the spirals) or a pop (the stars).
   */
  readonly special: 'none' | 'spiral' | 'star';
}

const both = (form: Eyes[0]): Eyes => [form, form];
const pose = (p: Partial<Pose>): Pose => ({ ...REST, ...p });
const SMILING = { blink: null, glances: false, bob: true } as const;

export const MOOD: Record<Mood, MoodSpec> = {
  neutral: { pose: REST, eyes: both(EYE.open), look: { x: 0, y: 0 }, idle: CALM, drift: 'none', special: 'none' },
  // Perky: a little taller, the tip up; smiling eyes that bob, and a bounce now and then.
  happy: { pose: pose({ stretch: 0.04, droop: -0.025 }), eyes: both(EYE.happy), look: { x: 0, y: 0 }, idle: { ...CALM, ...SMILING, bounceEvery: 6.5 }, drift: 'none', special: 'none' },
  // Tall and slim, chin up, almost still.
  proud: { pose: pose({ stretch: 0.11, puff: -0.06, droop: -0.055, lean: -0.012 }), eyes: both(EYE.proud), look: { x: 0, y: 0 }, idle: { ...CALM, ...SMILING, sway: 0.014, breath: 0.03, breathEvery: 4.6, bob: false }, drift: 'none', special: 'none' },
  // Leaning into the work, flickering fast, eyes sweeping.
  busy: { pose: pose({ stretch: -0.02, lean: 0.075, tip: 0.03 }), eyes: both(EYE.busy), look: { x: 0, y: 0.1 }, idle: { ...CALM, sway: 0.02, pace: 1.9, breath: 0.018, breathEvery: 1.7, flicker: 0.02, blink: [3.5, 7], glances: false, scan: true }, drift: 'none', special: 'none' },
  // Something is due soon: upright and set on it, the inner ends of the lids down, looking at the list, blinking often.
  keen: { pose: pose({ stretch: 0.055, puff: -0.025, droop: -0.03 }), eyes: both(EYE.keen), look: { x: 0, y: 0.45 }, idle: { ...CALM, sway: 0.018, pace: 1.25, blink: [1.4, 3], glances: false }, drift: 'none', special: 'none' },
  // Something is late: thin and tense, wide eyes on the list, a shiver now and then.
  worried: { pose: pose({ stretch: 0.06, puff: -0.085, lean: -0.014 }), eyes: both(EYE.worried), look: { x: 0, y: 0.7 }, idle: { ...CALM, sway: 0.016, pace: 2.1, breath: 0.02, breathEvery: 1.9, flicker: 0.022, blink: [2.2, 4.5], glances: false, shiverEvery: 4.2 }, drift: 'none', special: 'none' },
  // Thin and hanging: the tip bowed right over, eyes down.
  sad: { pose: pose({ stretch: -0.05, puff: -0.04, droop: 0.115 }), eyes: both(EYE.sad), look: { x: 0, y: 0.8 }, idle: { ...CALM, sway: 0.012, pace: 0.6, breath: 0.02, breathEvery: 5.2, flicker: 0.004, blink: [4, 8], glances: false }, drift: 'none', special: 'none' },
  // Asleep: settled low, the tip folded over, long slow breaths, one "z" after another.
  sleepy: { pose: pose({ stretch: -0.06, puff: 0.02, droop: 0.085, lean: 0.01 }), eyes: both(EYE.closed), look: { x: 0, y: 0 }, idle: { ...CALM, sway: 0.008, pace: 0.45, breath: 0.045, breathEvery: 5.8, flicker: 0.003, blink: null, glances: false }, drift: 'z', special: 'none' },
  // The data is old: nearly upright but dull, level half-closed lids, hardly breathing.
  stale: { pose: pose({ stretch: -0.03, droop: 0.02 }), eyes: both(EYE.half), look: { x: 0, y: 0.2 }, idle: { ...CALM, sway: 0.008, pace: 0.5, breath: 0.01, breathEvery: 6.5, flicker: 0.002, blink: [5, 9], glances: false }, drift: 'none', special: 'none' },
  // Pulled up tall, round eyes.
  surprised: { pose: pose({ stretch: 0.085, puff: 0.02, droop: -0.04 }), eyes: both(EYE.round), look: { x: 0, y: 0 }, idle: { ...CALM, sway: 0.016, blink: [3, 6], glances: false }, drift: 'none', special: 'none' },
  wink: { pose: pose({ lean: 0.016, stretch: 0.015 }), eyes: [EYE.open, EYE.wink], look: { x: 0, y: 0 }, idle: { ...CALM, blink: null, glances: false }, drift: 'none', special: 'none' },
  // Celebrating: the brand's star eyes, spinning (the jumps and the burst of stars are its reaction).
  celebrate: { pose: pose({ stretch: 0.05, droop: -0.03 }), eyes: both(EYE.star), look: { x: 0, y: 0 }, idle: { ...CALM, pace: 1.3, blink: null, glances: false }, drift: 'none', special: 'star' },
  // The page could not be read: rocking, spiral eyes, the flame rippling, stars circling overhead.
  dizzy: { pose: pose({ stretch: -0.03, droop: 0.03 }), eyes: both(EYE.round), look: { x: 0, y: 0 }, idle: { ...CALM, pace: 0.8, flicker: 0.024, rock: 5, blink: null, glances: false }, drift: 'orbit', special: 'spiral' },
};

/**
 * How one pair of eyes becomes another: blended shape to shape, or through a
 * blink (the lids close, the eyes change behind them, the lids open). The
 * star and spiral eyes are drawings of their own and cannot be blended.
 */
export type EyeChange = 'blend' | 'blink';

export function eyeChange(from: Mood, to: Mood): EyeChange {
  return MOOD[from].special !== 'none' || MOOD[to].special !== 'none' ? 'blink' : 'blend';
}
