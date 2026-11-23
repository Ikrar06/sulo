// One bend for the whole body. A pose is a handful of numbers; warpPoint
// moves any point of the brand frame by them, and the same function is
// applied to every control point of the back flame, the front flame and the
// face. So the two flame layers can only ever move as one body, and the tip
// can trail the base because the bend grows with height. Pure: no DOM.

import { BASE, BODY, EYES_CENTER, FRAME, type Outline, type Pt } from './shape';

export interface Pose {
  /** Taller (+) or shorter (-), from the base. It narrows as it grows, so the body keeps its volume. */
  readonly stretch: number;
  /** A bend to the right (+), small at the face and largest at the tip; in frame heights at the top. */
  readonly lean: number;
  /** The upper flame's own sideways throw, on top of the lean: what lags behind and swings past. */
  readonly tip: number;
  /** The tip bowing over and down (+) or reaching up (-). */
  readonly droop: number;
  /** A fuller (+) or thinner (-) upper flame. */
  readonly puff: number;
  /** A ripple running up the flame: its size, and where it is (in turns). */
  readonly wave: number;
  readonly phase: number;
  /**
   * A breath in: the flame above the chin rises by this much of its height
   * and slims a little. The base and the lower edge do not move, so the face
   * (which does not breathe) always sits exactly in the flame.
   */
  readonly rise: number;
}

export const REST: Pose = { stretch: 0, lean: 0, tip: 0, droop: 0, puff: 0, wave: 0, phase: 0, rise: 0 };

/** Where the body is, around its pose: lifted, shifted and tilted as a whole (jumps, shakes, wobbles). */
export interface Frame {
  /** The flame's pose: stance, idle sway and every reaction. */
  readonly pose: Pose;
  /**
   * The same without the idle sway: what the face and the eyes follow. The
   * sway barely reaches down to the face, so the face and the eyes stay
   * constant while the mascot only idles and need no animation of their own.
   */
  readonly core: Pose;
  /** Up, in frame units. */
  readonly lift: number;
  /** Right, in frame units. */
  readonly shift: number;
  /** Clockwise, in degrees, about the base. */
  readonly tilt: number;
}

export const REST_FRAME: Frame = { pose: REST, core: REST, lift: 0, shift: 0, tilt: 0 };

const POSE_KEYS = ['stretch', 'lean', 'tip', 'droop', 'puff', 'wave', 'phase', 'rise'] as const;

export function mixPose(a: Pose, b: Pose, t: number): Pose {
  const out = {} as Record<(typeof POSE_KEYS)[number], number>;
  for (const k of POSE_KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

export function addPose(a: Pose, b: Partial<Pose>): Pose {
  const out = {} as Record<(typeof POSE_KEYS)[number], number>;
  for (const k of POSE_KEYS) out[k] = a[k] + (b[k] ?? 0);
  return out;
}

const smooth = (from: number, to: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

/** How much narrower a body `sy` times as tall is. A little short of exact, so a tall pose is not a needle. */
export const widthFor = (sy: number) => Math.pow(sy, -0.85);

/** Moves one point of the brand frame by a pose. */
export function warpPoint(p: Pt, pose: Pose): Pt {
  const h = Math.max(0, (BASE.y - p.y) / FRAME.height);
  const sy = 1 + pose.stretch;
  const upper = smooth(0.3, 1, h);
  const top = smooth(0.45, 1, h);
  const top2 = top * top;
  const ripple = pose.wave === 0 ? 0 : pose.wave * h * Math.sin(2 * Math.PI * (1.15 * h - pose.phase));
  const above = smooth(0.12, 0.9, h);
  const x = BASE.x + (p.x - BASE.x) * widthFor(sy) * (1 + pose.puff * upper - 0.3 * pose.rise * above) + FRAME.height * (pose.lean * Math.pow(h, 1.6) + pose.tip * top2 + ripple + pose.droop * 0.45 * top2);
  const y = BASE.y - (BASE.y - p.y) * sy + FRAME.height * (pose.droop * top2 - pose.rise * above * h);
  return { x, y };
}

export interface BodyPaths {
  readonly back: string;
  readonly front: string;
  readonly face: string;
}

/**
 * An outline with everything that does not depend on the pose worked out
 * once per point (its height and the weights the bend uses), so a pose costs
 * a few multiplications a point. The rig bakes dozens of poses at a time.
 */
interface Prepared {
  readonly count: number;
  readonly dx: Float64Array;
  readonly up: Float64Array;
  readonly h: Float64Array;
  readonly h16: Float64Array;
  readonly upper: Float64Array;
  readonly top2: Float64Array;
  readonly above: Float64Array;
}

function prepare(o: Outline): Prepared {
  const points: Pt[] = [o.start, ...o.segs.flatMap((s) => [s[0], s[1], s[2]])];
  const count = points.length;
  const out = { count, dx: new Float64Array(count), up: new Float64Array(count), h: new Float64Array(count), h16: new Float64Array(count), upper: new Float64Array(count), top2: new Float64Array(count), above: new Float64Array(count) };
  points.forEach((p, i) => {
    const h = Math.max(0, (BASE.y - p.y) / FRAME.height);
    const top = smooth(0.45, 1, h);
    out.dx[i] = p.x - BASE.x;
    out.up[i] = BASE.y - p.y;
    out.h[i] = h;
    out.h16[i] = Math.pow(h, 1.6);
    out.upper[i] = smooth(0.3, 1, h);
    out.top2[i] = top * top;
    out.above[i] = smooth(0.12, 0.9, h);
  });
  return out;
}

const PREPARED = { back: prepare(BODY.back), front: prepare(BODY.front), face: prepare(BODY.face) };

/** The same rule as warpPoint, over a prepared outline, straight to a path string (one decimal). */
function pathIn(o: Prepared, pose: Pose): string {
  const sy = 1 + pose.stretch;
  const sx = widthFor(sy);
  const H = FRAME.height;
  let d = '';
  for (let i = 0; i < o.count; i += 1) {
    const h = o.h[i]!;
    const top2 = o.top2[i]!;
    const ripple = pose.wave === 0 ? 0 : pose.wave * h * Math.sin(2 * Math.PI * (1.15 * h - pose.phase));
    const above = o.above[i]!;
    const x = BASE.x + o.dx[i]! * sx * (1 + pose.puff * o.upper[i]! - 0.3 * pose.rise * above) + H * (pose.lean * o.h16[i]! + pose.tip * top2 + ripple + pose.droop * 0.45 * top2);
    const y = BASE.y - o.up[i]! * sy + H * (pose.droop * top2 - pose.rise * above * h);
    d += `${i === 0 ? 'M' : i % 3 === 1 ? 'C' : ' '}${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`;
  }
  return `${d}Z`;
}

/** The three body shapes in a pose, as path strings. */
export function bodyPaths(pose: Pose): BodyPaths {
  return { back: pathIn(PREPARED.back, pose), front: pathIn(PREPARED.front, pose), face: pathIn(PREPARED.face, pose) };
}

/** One shape alone. */
export const backPath = (pose: Pose): string => pathIn(PREPARED.back, pose);
export const frontPath = (pose: Pose): string => pathIn(PREPARED.front, pose);
export const facePath = (pose: Pose): string => pathIn(PREPARED.face, pose);

/**
 * Where the eyes ride in a pose: moved with the face, and squashed half as
 * much as the body (they must stay readable). A CSS transform for the eyes'
 * group, whose origin is the midpoint between the eyes.
 */
export function eyesTransform(pose: Pose): string {
  const at = warpPoint(EYES_CENTER, pose);
  const sy = 1 + pose.stretch;
  const sx = 1 + (widthFor(sy) - 1) * 0.5;
  const ey = 1 + pose.stretch * 0.5;
  return `translate(${(at.x - EYES_CENTER.x).toFixed(2)}px, ${(at.y - EYES_CENTER.y).toFixed(2)}px) scale(${sx.toFixed(4)}, ${ey.toFixed(4)})`;
}

/** The whole body's transform for a frame (its origin is the base). */
export function rootTransform(f: Frame): string {
  return `translate(${f.shift.toFixed(2)}px, ${(-f.lift).toFixed(2)}px) rotate(${f.tilt.toFixed(3)}deg)`;
}

/**
 * A spring from `from` to `to`, starting at rest: where it is after `t`
 * seconds. `hz` is how fast it swings, `damping` how soon it settles
 * (1 never overshoots; 0.3 swings past a few times).
 */
export function spring(t: number, from: number, to: number, hz: number, damping: number): number {
  if (t <= 0) return from;
  const w = 2 * Math.PI * hz;
  const d = Math.min(0.999, Math.max(0.05, damping));
  const wd = w * Math.sqrt(1 - d * d);
  const decay = Math.exp(-d * w * t);
  return to + (from - to) * decay * (Math.cos(wd * t) + ((d * w) / wd) * Math.sin(wd * t));
}
