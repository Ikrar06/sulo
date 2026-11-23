// The mascot's tempo and curves, in one place. They sit beside the app's own
// motion tokens (apps/mobile/src/onboarding/motion.ts): the same strong
// ease-out, the same small overshoot, and times in the same family (the
// app's check is 160 ms, an entrance 320 ms; SCENE_TEMPO stretches scenes,
// never the mascot's own reflexes).

export const EASE = {
  /** The app's ease-out (EASE_OUT): arriving, opening. */
  out: 'cubic-bezier(0.22, 1, 0.36, 1)',
  /** The app's small overshoot (EASE_SPRING, about 4%): eyes opening, a shape arriving. */
  pop: 'cubic-bezier(0.34, 1.36, 0.64, 1)',
  /** A lid coming down: slow to start, fast at the end, as a lid falls. Only ever for the closing half of a blink. */
  lidDown: 'cubic-bezier(0.5, 0, 0.9, 0.4)',
} as const;

/** A whole blink: down in the first 42%, up in the rest. */
export const BLINK_MS = 165;
/** One eye shape blending into another. */
export const EYE_CHANGE_MS = 240;
/**
 * While it only idles, the flame's shape is written this many times a second
 * (half that for a small mascot), by one timer: no animation runs. Measured
 * on WebView 113: an animation that never stops makes the page produce every
 * frame, about 1 ms each, whatever it animates; thirty writes a second cost
 * half that, and slow sway at thirty a second cannot be told from sixty.
 */
export const IDLE_HZ = 30;
/** Keyframes a second for a move (a reaction, a change of stance): played by the browser at full rate. */
export const MOVE_KEYS = 40;
/** A mascot under 72 px sways this much further for its size (the same motion would be under a pixel). */
export const SMALL_GAIN = 1.6;
