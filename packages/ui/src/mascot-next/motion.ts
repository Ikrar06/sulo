// What the body is doing at any moment, as one pure function of time.
//
//   frame(T) = the expression's stance (arriving on springs from the last one)
//            + its idle life (sway and flicker: sines of unlike periods,
//              so the pattern does not come round again)
//            + every reaction in flight (each one an offset that starts and
//              ends at nothing)
//
// Nothing here touches the DOM. The rig samples this function ahead of time
// into keyframes and lets the browser play them; a change (a new expression,
// a reaction) only re-samples from "now", and since every term is continuous
// the body never jumps.

import { MOOD, type Idle, type Mood } from './moods';
import { addPose, mixPose, spring, type Frame, type Pose } from './warp';

const TAU = Math.PI * 2;
const smooth = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};
const easeOut = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

/** What an offset adds to the body at a moment. */
export type Offset = Partial<Pose> & { lift?: number; shift?: number; tilt?: number };

/** An offset over the idle body: a reaction, a bounce, a shiver. Starts and ends at zero. Times in seconds. */
export interface Extra {
  readonly duration: number;
  readonly at: (t: number) => Offset;
}

/** The sizes of an expression's idle life: what is blended across a change. */
export type IdleStrength = Pick<Idle, 'sway' | 'flicker' | 'rock' | 'breath'>;

interface Running {
  readonly extra: Extra;
  readonly start: number;
  /** A reaction (one at a time: a new one fades the last out) or one of the idle's own small moves. */
  readonly kind: 'reaction' | 'idle';
}

export interface Motion {
  readonly mood: Mood;
  /** When this expression began (seconds on the rig's clock). */
  readonly since: number;
  /** The stance it left from (mid-change stances included). */
  readonly fromPose: Pose;
  /** How strongly it was idling when it left (mid-change strengths included). */
  readonly fromIdle: IdleStrength;
  /** Sway and breath run on their own clocks, kept across a change of pace. */
  readonly swayAt: number;
  readonly breathAt: number;
  readonly extras: readonly Running[];
}

const STILL: IdleStrength = { sway: 0, flicker: 0, rock: 0, breath: 0 };

/** A mascot that has just appeared: at rest in its expression, its idle life growing in from nothing. */
export function startMotion(mood: Mood, now = 0): Motion {
  return { mood, since: now, fromPose: MOOD[mood].pose, fromIdle: STILL, swayAt: 0, breathAt: 0, extras: [] };
}

/** Seconds a change of expression takes to settle (the tip is the last to come to rest). */
export const SETTLE = 1.25;
/** The beat before a big move: the body first gives a little the other way. */
const ANTICIPATION = 0.11;
/** The tip's sway runs this far behind the body's (seconds of sway): far enough to read as trailing. */
const TIP_LAG = 0.9;

// How fast each part follows a change: the body is firm, the tip is loose and swings past.
const FIRM = { hz: 3.3, damping: 0.62 } as const;
const LOOSE = { hz: 1.25, damping: 0.36 } as const;

const firm = (t: number) => spring(t, 0, 1, FIRM.hz, FIRM.damping);
const loose = (t: number) => spring(t, 0, 1, LOOSE.hz, LOOSE.damping);

/** The stance at `t` seconds into a change from one stance to another. */
export function stanceAt(from: Pose, to: Pose, t: number): Pose {
  if (t >= SETTLE + 1.2) return to;
  const dStretch = to.stretch - from.stretch;
  const dLean = to.lean - from.lean;
  const big = Math.abs(dStretch) > 0.03;
  const lead = big ? ANTICIPATION : 0;
  if (t < lead) {
    // Anticipation: a quick dip before rising, a small lift before sinking.
    const u = easeOut(t / lead);
    return addPose(from, { stretch: -0.32 * dStretch * u, puff: 0.12 * dStretch * u });
  }
  const s = t - lead;
  const start = big ? addPose(from, { stretch: -0.32 * dStretch, puff: 0.12 * dStretch }) : from;
  const k = firm(s);
  const body = mixPose(start, to, k);
  // The tip is left behind and then swings past: the difference between a loose follower and the firm body.
  const lag = loose(s) - k;
  return addPose(body, { droop: -lag * (to.stretch - start.stretch) * 0.62, tip: lag * dLean * 0.9 + lag * (to.tip - from.tip) });
}

const mixIdle = (a: IdleStrength, b: IdleStrength, k: number): IdleStrength => ({
  sway: a.sway + (b.sway - a.sway) * k,
  flicker: a.flicker + (b.flicker - a.flicker) * k,
  rock: a.rock + (b.rock - a.rock) * k,
  breath: a.breath + (b.breath - a.breath) * k,
});

/**
 * The body at `now` seconds: stance, idle life and every reaction in flight.
 * `gain` enlarges the idle life (a small mascot sways further for its size,
 * or the motion is under a pixel).
 */
export function frameAt(m: Motion, now: number, gain = 1): Frame {
  const spec = MOOD[m.mood];
  const t = Math.max(0, now - m.since);
  const stance = stanceAt(m.fromPose, spec.pose, t);
  const idle = mixIdle(m.fromIdle, spec.idle, smooth(t / 0.6));
  const sway = m.swayAt + t * spec.idle.pace; // seconds of sway at pace 1
  const size = idle.sway * gain;
  // Periods that share no small multiple: 4.3, 6.7, 2.9, 1.7 and 5.1 s. The tip follows the body's swing well behind it.
  const lean = size * (0.62 * Math.sin((TAU * sway) / 4.3) + 0.38 * Math.sin((TAU * sway) / 6.7 + 1.3));
  const tip = size * (0.85 * Math.sin((TAU * (sway - TIP_LAG)) / 4.3) + 0.5 * Math.sin((TAU * sway) / 2.9 + 0.7) + 0.32 * Math.sin((TAU * sway) / 1.7 + 2.1));
  const droop = size * 0.3 * Math.sin((TAU * sway) / 5.1 + 0.4);
  // A breath: the flame above the chin rises and falls. The face does not breathe (see warp.ts, `rise`).
  const breath = m.breathAt + t / spec.idle.breathEvery;
  const rise = idle.breath * gain * (0.5 - 0.5 * Math.cos(TAU * breath));
  let core = stance;
  let pose = addPose(stance, { lean, tip, droop, rise, wave: idle.flicker * gain, phase: sway / 2.3 });
  let lift = 0;
  let shift = 0;
  let tilt = idle.rock * Math.sin((TAU * sway) / 1.9);
  for (const { extra, start } of m.extras) {
    const u = now - start;
    if (u < 0 || u >= extra.duration) continue;
    const d = extra.at(u);
    pose = addPose(pose, d);
    core = addPose(core, d);
    lift += d.lift ?? 0;
    shift += d.shift ?? 0;
    tilt += d.tilt ?? 0;
  }
  return { pose, core, lift, shift, tilt };
}

/** The stance alone (no idle, no reactions): what a still mascot shows, and what a change leaves from. */
export function stanceNow(m: Motion, now: number): Pose {
  return stanceAt(m.fromPose, MOOD[m.mood].pose, Math.max(0, now - m.since));
}

/** A new expression from `now`, leaving from wherever the body is. */
export function changeMood(m: Motion, mood: Mood, now: number): Motion {
  const spec = MOOD[m.mood];
  const t = Math.max(0, now - m.since);
  return { mood, since: now, fromPose: stanceNow(m, now), fromIdle: mixIdle(m.fromIdle, spec.idle, smooth(t / 0.6)), swayAt: m.swayAt + t * spec.idle.pace, breathAt: m.breathAt + t / spec.idle.breathEvery, extras: m.extras };
}

const FADE = 0.12;

/** The same offset, let go of at `cut` seconds: it fades to nothing over a tenth of a second instead of vanishing. */
function letGo(extra: Extra, cut: number): Extra {
  return {
    duration: Math.min(extra.duration, cut + FADE),
    at: (t) => {
      const k = 1 - smooth((t - cut) / FADE);
      const d = extra.at(t);
      const out: Record<string, number> = {};
      for (const [key, v] of Object.entries(d)) out[key] = (v ?? 0) * k;
      return out;
    },
  };
}

/**
 * Adds an offset from `now`; finished ones are dropped. A reaction takes the
 * place of the one in flight, which is let go of smoothly: two never add up
 * (ten quick taps are one tap restarted, not a pile).
 */
export function addExtra(m: Motion, extra: Extra, now: number, kind: Running['kind'] = 'reaction'): Motion {
  const alive = m.extras.filter((e) => now - e.start < e.extra.duration);
  const kept = kind === 'reaction' ? alive.map((e) => (e.kind === 'reaction' ? { ...e, extra: letGo(e.extra, now - e.start) } : e)) : alive;
  return { ...m, extras: [...kept, { extra, start: now, kind }] };
}

/** Seconds from `now` until every reaction and the change of stance are over. 0 when only idle life is left. */
export function busyFor(m: Motion, now: number): number {
  const to = MOOD[m.mood].pose;
  const changing = (Object.keys(to) as (keyof Pose)[]).some((k) => Math.abs(to[k] - m.fromPose[k]) > 1e-6);
  let until = changing ? m.since + SETTLE + 1.2 : 0;
  for (const e of m.extras) until = Math.max(until, e.start + e.extra.duration);
  return Math.max(0, until - now);
}

// ---------- Reactions: offsets over the idle body ----------

/** A value through timed keys: [seconds, value]. Eased in and out between keys. */
function keys(points: readonly (readonly [number, number])[]): (t: number) => number {
  return (t) => {
    if (t <= points[0]![0]) return points[0]![1];
    for (let i = 1; i < points.length; i += 1) {
      const [t1, v1] = points[i]!;
      if (t <= t1) {
        const [t0, v0] = points[i - 1]!;
        return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
      }
    }
    return points[points.length - 1]![1];
  };
}

/** A swing that dies away: for whatever trails a move and has to settle. */
const settle = (t: number, size: number, hz: number, fade: number) => (t <= 0 ? 0 : size * Math.exp(-t / fade) * Math.sin(TAU * hz * t));

/** A hop in an arc: up `height` between `from` and `to` seconds. */
const hop = (t: number, from: number, to: number, height: number) => {
  if (t <= from || t >= to) return 0;
  const u = (t - from) / (to - from);
  return height * 4 * u * (1 - u);
};

interface JumpPart {
  readonly end: number;
  readonly at: (t: number) => { lift: number; stretch: number; droop: number; puff: number };
}

/** One jump of `height` frame units starting at `t0`. Squash, stretch, a true arc, and the tip trailing. */
function jumpPart(t0: number, height: number, first: boolean): JumpPart {
  const crouch = first ? 0.15 : 0.08;
  const air = 0.3 + height * 0.0034;
  const up = t0 + crouch;
  const down = up + air;
  const land = 0.13;
  const deep = first ? 0.13 : 0.08;
  // Every part meets the next at the same value: the crouch's depth turns into the take-off stretch over two frames,
  // and the fall's stretch into the landing squash the same way.
  const stretch = keys([
    [t0, 0],
    [up, -deep],
    [up + 0.05, 0.11],
    [up + air * 0.5, 0.015],
    [down - 0.04, 0.1],
    [down + 0.045, -0.12 * (0.55 + height / 180)],
    [down + land, 0],
  ]);
  const droop = keys([
    [t0, 0],
    [up, 0.03],
    [up + 0.07, 0.06],
    [up + air * 0.5, 0],
    [down - 0.03, -0.055],
    [down + 0.05, 0.03],
    [down + land, 0],
  ]);
  const puff = keys([
    [t0, 0],
    [up, 0.035],
    [up + 0.05, -0.03],
    [up + air * 0.5, 0],
    [down - 0.04, -0.03],
    [down + 0.045, 0.045],
    [down + land, 0],
  ]);
  return {
    end: down + land,
    at: (t) => (t < t0 || t > down + land ? { lift: 0, stretch: 0, droop: 0, puff: 0 } : { lift: hop(t, up, down, height), stretch: stretch(t), droop: droop(t), puff: puff(t) }),
  };
}

function jumps(heights: readonly number[]): Extra {
  const parts: JumpPart[] = [];
  let t = 0;
  heights.forEach((h, i) => {
    const part = jumpPart(t, h, i === 0);
    parts.push(part);
    t = part.end - 0.05; // the landing squash runs into the next jump's crouch
  });
  const landed = parts[parts.length - 1]!.end;
  const tail = 0.85;
  return {
    duration: landed + tail,
    at: (u) => {
      const out = { lift: 0, stretch: 0, droop: 0, puff: 0 };
      for (const p of parts) {
        const d = p.at(u);
        out.lift += d.lift;
        out.stretch += d.stretch;
        out.droop += d.droop;
        out.puff += d.puff;
      }
      // After the last landing the body rebounds once and the tip whips forward and settles.
      const after = u - landed;
      out.stretch += settle(after, 0.07, 3.1, 0.17);
      out.droop += settle(after, -0.065, 2.3, 0.24);
      return { ...out, tip: settle(after, 0.04, 2.3, 0.26) };
    },
  };
}

/** Where a celebration's two jumps leave the ground (seconds from its start): when the stars burst. */
export const CELEBRATE_JUMPS = [88, 46] as const;

export type ReactionName = 'tap' | 'jump' | 'celebrate' | 'startle' | 'sag' | 'done' | 'fail' | 'checked' | 'incoming' | 'near' | 'allClear';

/** What a reaction does to the body. */
export const REACTION_BODY: Record<ReactionName, Extra> = {
  // Touched: pressed down, a small hop, the tip flicking after it.
  tap: {
    duration: 1.05,
    at: (t) => ({
      stretch: keys([[0, 0], [0.08, -0.12], [0.2, 0.085], [0.4, -0.06], [0.52, 0]])(t) + settle(t - 0.52, 0.055, 3.4, 0.15),
      puff: keys([[0, 0], [0.08, 0.045], [0.2, -0.025], [0.4, 0.02], [0.52, 0]])(t),
      lift: hop(t, 0.14, 0.42, 28),
      droop: keys([[0, 0], [0.1, 0.035], [0.24, 0.055], [0.42, -0.05], [0.56, 0]])(t) + settle(t - 0.56, -0.04, 2.6, 0.22),
      tip: settle(t - 0.42, 0.035, 2.6, 0.24),
    }),
  },
  jump: jumps([70]),
  celebrate: jumps(CELEBRATE_JUMPS),
  allClear: jumps(CELEBRATE_JUMPS),
  // Startled: shot up tall in two frames, held, then settling with a wobble.
  startle: {
    duration: 1.4,
    at: (t) => ({
      stretch: keys([[0, 0], [0.07, 0.17], [0.34, 0.12], [0.62, 0]])(t) + settle(t - 0.62, -0.055, 3, 0.19),
      puff: keys([[0, 0], [0.07, -0.05], [0.34, -0.02], [0.62, 0]])(t),
      lift: hop(t, 0, 0.3, 16),
      droop: keys([[0, 0], [0.07, 0.07], [0.2, -0.055], [0.6, 0]])(t) + settle(t - 0.6, 0.05, 2.4, 0.26),
      tip: settle(t - 0.07, -0.05, 2.8, 0.32),
    }),
  },
  // Let down: a small rise, then sinking, the tip folding last; it comes back slowly.
  sag: {
    duration: 2.6,
    at: (t) => ({
      stretch: keys([[0, 0], [0.12, 0.025], [0.62, -0.13], [1.7, -0.13], [2.4, 0]])(t),
      puff: keys([[0, 0], [0.62, 0.05], [1.7, 0.05], [2.4, 0]])(t),
      droop: keys([[0, 0], [0.2, -0.01], [0.85, 0.1], [1.75, 0.1], [2.55, 0]])(t),
      tip: settle(t - 0.62, 0.025, 1.3, 0.5),
    }),
  },
  // An update finished: one nod.
  done: {
    duration: 1,
    at: (t) => ({
      stretch: keys([[0, 0], [0.1, -0.075], [0.26, 0.065], [0.44, 0]])(t) + settle(t - 0.44, 0.035, 3.2, 0.15),
      droop: keys([[0, 0], [0.12, 0.045], [0.3, -0.045], [0.5, 0]])(t) + settle(t - 0.5, -0.03, 2.6, 0.22),
      puff: keys([[0, 0], [0.1, 0.03], [0.26, -0.02], [0.44, 0]])(t),
    }),
  },
  // An update failed: a shake of the head, the tip a beat behind each turn, then a small slump.
  fail: {
    duration: 1.6,
    at: (t) => {
      const fade = smooth(t / 0.06) * (t < 0.66 ? 1 : Math.max(0, 1 - (t - 0.66) / 0.2));
      const turn = Math.sin((TAU * t) / 0.33);
      return {
        lean: 0.045 * turn * fade,
        tip: -0.05 * Math.sin((TAU * (t - 0.08)) / 0.33) * fade + settle(t - 0.74, 0.03, 2.8, 0.22),
        shift: 14 * turn * fade,
        tilt: 3.2 * turn * fade,
        stretch: keys([[0, 0], [0.7, 0], [0.98, -0.065], [1.25, -0.065], [1.6, 0]])(t),
        droop: keys([[0, 0], [0.78, 0], [1.05, 0.045], [1.25, 0.045], [1.6, 0]])(t),
      };
    },
  },
  // A task ticked: a glad little hop.
  checked: {
    duration: 0.95,
    at: (t) => ({
      stretch: keys([[0, 0], [0.07, -0.08], [0.17, 0.08], [0.36, -0.05], [0.46, 0]])(t) + settle(t - 0.46, 0.04, 3.4, 0.15),
      lift: hop(t, 0.1, 0.36, 22),
      droop: keys([[0, 0], [0.1, 0.035], [0.36, -0.04], [0.5, 0]])(t) + settle(t - 0.5, -0.03, 2.6, 0.22),
    }),
  },
  // Something new came in: it perks up.
  incoming: {
    duration: 1.2,
    at: (t) => ({
      stretch: keys([[0, 0], [0.09, -0.035], [0.24, 0.11], [0.7, 0.065], [1.05, 0]])(t),
      puff: keys([[0, 0], [0.24, -0.035], [0.7, -0.02], [1.05, 0]])(t),
      droop: keys([[0, 0], [0.2, 0.035], [0.4, -0.055], [0.8, -0.03], [1.1, 0]])(t),
      tip: settle(t - 0.24, -0.035, 2.6, 0.28),
    }),
  },
  // A deadline is close: a quick shiver, slow enough to see.
  near: {
    duration: 0.9,
    at: (t) => {
      const fade = smooth(t / 0.05) * Math.max(0, 1 - Math.max(0, t - 0.5) / 0.22);
      return {
        shift: 8 * Math.sin((TAU * t) / 0.11) * fade,
        tip: 0.02 * Math.sin((TAU * (t - 0.035)) / 0.11) * fade,
        stretch: keys([[0, 0], [0.08, 0.055], [0.55, 0.045], [0.88, 0]])(t),
        puff: keys([[0, 0], [0.08, -0.045], [0.55, -0.035], [0.88, 0]])(t),
      };
    },
  },
};

/** The small things an idle expression does by itself now and then, and the nod a small change of expression gets. */
export const IDLE_EXTRA = {
  bounce: {
    duration: 0.9,
    at: (t: number): Offset => ({
      stretch: keys([[0, 0], [0.09, -0.07], [0.2, 0.07], [0.4, -0.04], [0.5, 0]])(t) + settle(t - 0.5, 0.035, 3.3, 0.15),
      lift: hop(t, 0.12, 0.4, 20),
      droop: keys([[0, 0], [0.12, 0.03], [0.4, -0.035], [0.52, 0]])(t) + settle(t - 0.52, -0.028, 2.6, 0.22),
    }),
  },
  shiver: {
    duration: 0.62,
    at: (t: number): Offset => {
      const fade = smooth(t / 0.05) * Math.max(0, 1 - Math.max(0, t - 0.34) / 0.24);
      return { shift: 6 * Math.sin((TAU * t) / 0.11) * fade, tip: 0.016 * Math.sin((TAU * (t - 0.035)) / 0.11) * fade };
    },
  },
  // A change of expression whose stance hardly differs (neutral to happy): the body still answers, with one small squash.
  nod: {
    duration: 0.62,
    at: (t: number): Offset => ({
      stretch: keys([[0, 0], [0.09, -0.055], [0.22, 0.04], [0.36, 0]])(t) + settle(t - 0.36, 0.02, 3.3, 0.13),
      puff: keys([[0, 0], [0.09, 0.025], [0.22, -0.012], [0.36, 0]])(t),
      droop: keys([[0, 0], [0.12, 0.02], [0.28, -0.025], [0.42, 0]])(t) + settle(t - 0.42, -0.012, 2.6, 0.18),
    }),
  },
} as const satisfies Record<string, Extra>;

/** A change of stance this small gets the nod (the springs alone would not be seen). */
export const smallChange = (from: Pose, to: Pose): boolean => Math.abs(to.stretch - from.stretch) < 0.05 && Math.abs(to.droop - from.droop) < 0.05 && Math.abs(to.lean - from.lean) < 0.03;
