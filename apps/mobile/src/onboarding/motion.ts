// Onboarding motion (M8c.2): one place for durations and curves, a stagger
// helper and the FLIP move the persistent mascot uses. Transform and
// opacity only (plus stroke-dashoffset for the drawn lines). Nothing starts
// from scale(0): entrances begin at 0.92 or more. Enter 240-420 ms with a
// strong ease-out, exit 160-200 ms ease-in, siblings 70 ms apart. Under
// reduced motion everything is a 120 ms fade and collages sit at rest.

import { dur, isLite } from '../perf';

/** Confident arrival: fast start, long settle (the sheet's opening curve). */
export const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
/** Story motion (the scenes): a long, soft slowing at the end, never an abrupt stop. */
export const EASE_STORY = 'cubic-bezier(0.16, 1, 0.3, 1)';

/**
 * Two kinds of motion. Response motion (buttons, a tapped row, a switch, a
 * step change, the pager, sheets) stays quick and never uses this. Story
 * motion (the scenes of screens 0, 1, 2, 3, 5 and 9) is written at a base
 * pace and multiplied by SCENE_TEMPO: 1.4 by default, so an element takes
 * 450 to 560 ms to arrive and siblings follow 130 to 170 ms apart. The
 * debug screen can change it (0.8 to 2.0) to find the right pace on a phone.
 */
export const SCENE_TEMPO_DEFAULT = 1.4;
export const SCENE_TEMPO_KEY = 'mobile:dev:sceneTempo';
let tempo = SCENE_TEMPO_DEFAULT;
export const sceneTempo = (): number => tempo;
export function setSceneTempo(v: number): void {
  tempo = Number.isFinite(v) ? Math.min(2, Math.max(0.8, v)) : SCENE_TEMPO_DEFAULT;
}

/** Leaving: a smooth ease-in, never a bounce. */
export const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';
/** A small overshoot for the splash mascot and a landing notification (about 4%). */
export const EASE_SPRING = 'cubic-bezier(0.34, 1.36, 0.64, 1)';

export const MS = {
  enter: 320,
  enterLong: 420,
  exit: 180,
  stagger: 70,
  mascotMove: 360,
  landing: 420,
  dots: 200,
  check: 160,
  reduced: 120,
} as const;

/** A short phone (360x640): decided once at start, so the keyboard coming up later changes nothing. */
export const SHORT_SCREEN = typeof window !== 'undefined' && window.innerHeight < 700;

/**
 * The scenes' simple level (lite tier, src/perf.ts): every piece still
 * arrives in its place, but as one short fade and 8 px rise; the multi-step
 * acts (a ringing bell, a wobble), drawn lines, counting numbers and sparks
 * show at rest. The resting picture is the same as in full.
 */
export const simpleScenes = (): boolean => isLite();

export const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface EnterFrom {
  y?: number;
  x?: number;
  scale?: number;
  rotate?: number;
}

const transformOf = (f: EnterFrom, rest: { rotate?: number } = {}) => `translate(${f.x ?? 0}px, ${f.y ?? 0}px) rotate(${f.rotate ?? rest.rotate ?? 0}deg) scale(${f.scale ?? 1})`;

/**
 * One element in: from `from` to its resting transform (`rest`, e.g. the
 * collage tilt). Reduced motion: a 120 ms fade at rest. Returns the
 * animation, or null when the element is gone.
 */
export function enter(el: Element | null, from: EnterFrom, options: { delay?: number; duration?: number; easing?: string; rest?: { rotate?: number; scale?: number; x?: number; y?: number } } = {}): Animation | null {
  if (!el || typeof (el as HTMLElement).animate !== 'function') return null;
  const rest = options.rest ?? {};
  const end = transformOf({ x: rest.x, y: rest.y, rotate: rest.rotate, scale: rest.scale });
  if (reducedMotion()) return (el as HTMLElement).animate([{ opacity: 0, transform: end }, { opacity: 1, transform: end }], { duration: MS.reduced, delay: 0, fill: 'backwards' });
  if (simpleScenes()) {
    const rise = transformOf({ x: rest.x, y: (rest.y ?? 0) + 8, rotate: rest.rotate, scale: rest.scale });
    return (el as HTMLElement).animate([{ opacity: 0, transform: rise }, { opacity: 1, transform: end }], { duration: dur(MS.enter), delay: options.delay ?? 0, easing: EASE_OUT, fill: 'backwards' });
  }
  const start = transformOf({ x: (rest.x ?? 0) + (from.x ?? 0), y: (rest.y ?? 0) + (from.y ?? 0), rotate: from.rotate ?? rest.rotate, scale: (rest.scale ?? 1) * Math.max(0.92, from.scale ?? 1) });
  return (el as HTMLElement).animate([{ opacity: 0, transform: start }, { opacity: 1, transform: end }], { duration: options.duration ?? MS.enter, delay: options.delay ?? 0, easing: options.easing ?? EASE_OUT, fill: 'backwards' });
}

/** Delays for siblings: 70 ms apart, the whole run capped so nothing waits long. */
export function staggerDelays(count: number, base = 0, step: number = MS.stagger, cap = 420): number[] {
  return Array.from({ length: count }, (_, i) => base + Math.min(i * step, cap));
}

/** Draws an SVG stroke (a dashed connector or a check) by its dash offset. */
export function draw(path: SVGPathElement | SVGPolylineElement | null, options: { delay?: number; duration?: number } = {}): Animation | null {
  if (!path || typeof path.animate !== 'function' || typeof path.getTotalLength !== 'function') return null;
  const length = path.getTotalLength();
  if (reducedMotion() || simpleScenes()) return null;
  path.style.strokeDasharray = path.dataset.dash ?? `${length}`;
  return path.animate([{ strokeDashoffset: `${length}` }, { strokeDashoffset: '0' }], { duration: options.duration ?? 420, delay: options.delay ?? 0, easing: EASE_OUT, fill: 'backwards' });
}

export interface Box {
  x: number;
  y: number;
  size: number;
}

/**
 * The FLIP step between two boxes for an element drawn at `base` px: the
 * transform that puts it in `to`, starting from where it showed in `from`.
 */
export function flip(from: Box | null, to: Box, base: number): { keyframes: Keyframe[]; end: string } {
  const at = (b: Box) => `translate(${b.x}px, ${b.y}px) scale(${b.size / base})`;
  const end = at(to);
  // The first appearance (the splash): a spark that grows into the flame from its base, never from nothing.
  const born = `translate(${to.x + to.size * 0.2}px, ${to.y + to.size * 0.36}px) scale(${(to.size / base) * 0.6})`;
  return { end, keyframes: from ? [{ transform: at(from) }, { transform: end }] : [{ transform: born, opacity: 0 }, { transform: end, opacity: 1 }] };
}
