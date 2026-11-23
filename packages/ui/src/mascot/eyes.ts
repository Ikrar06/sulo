// The eyes as shapes that can turn into one another. Every form is one
// closed outline of eight cubic segments, starting at its top center and
// going clockwise, with the same eight anchors in the same order (top, top
// right, right, bottom right, bottom, bottom left, left, top left). So the
// browser can blend any form into any other point by point: an open eye
// caves in from below into a smiling arch, sinks under a lid, or bursts into
// a star, and nothing ever swaps in one frame. Pure: no DOM.

import { EYE_CENTERS, mapOutline, outlineToPath, type Cubic, type Outline, type Pt } from './shape';

export type EyeForm =
  /** A rounded bar: the open eye, and with a lid the half-closed, sad and focused ones. */
  | { readonly kind: 'pill'; readonly w: number; readonly h: number; readonly lid?: number; readonly slope?: number; readonly dy?: number }
  /** A smiling arch (the bold happy eye): outer width, height, thickness. */
  | { readonly kind: 'arch'; readonly w: number; readonly h: number; readonly t: number; readonly dy?: number }
  /** The arch upside down: an eye closed in rest. */
  | { readonly kind: 'cup'; readonly w: number; readonly h: number; readonly t: number; readonly dy?: number }
  /** A four-point star (celebrating). */
  | { readonly kind: 'star'; readonly r: number; readonly dy?: number };

/** The two eyes of an expression, left then right. */
export type Eyes = readonly [EyeForm, EyeForm];

const K = 0.5523; // a quarter circle as one cubic

const pt = (x: number, y: number): Pt => ({ x, y });

/** The right half of a symmetric outline (top center to bottom center) mirrored to make the whole. */
function mirrored(right: readonly Cubic[], top: Pt): Outline {
  const flip = (p: Pt) => pt(-p.x, p.y);
  const starts = [top, ...right.map((s) => s[2])];
  const left: Cubic[] = [];
  for (let i = right.length - 1; i >= 0; i -= 1) {
    const [a, b] = right[i]!;
    left.push([flip(b), flip(a), flip(starts[i]!)]);
  }
  return { start: top, segs: [...right, ...left] };
}

const line = (from: Pt, to: Pt): Cubic => [pt(from.x + (to.x - from.x) / 3, from.y + (to.y - from.y) / 3), pt(from.x + ((to.x - from.x) * 2) / 3, from.y + ((to.y - from.y) * 2) / 3), to];

function pill(w: number, h: number, lid: number, slope: number, side: number): Outline {
  const a = w / 2;
  const yb = h / 2;
  const yt = -h / 2 + Math.max(0, Math.min(0.92, lid)) * h;
  const span = yb - yt;
  // An open eye is round at the top; under a lid the top is nearly flat.
  const rt = Math.min(lid > 0 ? Math.max(3, a * (1 - lid * 3.2)) : a, span / 2);
  const rb = Math.min(a, span / 2);
  const ym = (yt + rt + yb - rb) / 2;
  const top = pt(0, yt);
  const a1 = pt(a, yt + rt);
  const r = pt(a, ym);
  const a2 = pt(a, yb - rb);
  const bottom = pt(0, yb);
  const right: Cubic[] = [
    [pt(K * a, yt), pt(a, yt + rt - K * rt), a1],
    line(a1, r),
    line(r, a2),
    [pt(a, yb - rb + K * rb), pt(K * a, yb), bottom],
  ];
  const whole = mirrored(right, top);
  if (slope === 0) return whole;
  // A slanted lid: the outer end of the top edge sits lower. Only the top edge moves.
  const edge = yt + rt + 0.5;
  const tilt = (p: Pt) => (p.y <= edge ? pt(p.x, p.y + slope * (p.x / a) * side) : p);
  return mapOutline(whole, tilt);
}

function arch(w: number, h: number, t: number): Outline {
  // A band bent over: the outer quarter of an ellipse down to the foot, a round cap under the foot (two quarter
  // circles), and the inner quarter back up to the middle. The same thickness all the way, like a round-capped stroke.
  const a = w / 2;
  const yf = h / 2 - t / 2; // the feet's centers; a cap of radius t/2 hangs below each
  const ro = yf + h / 2;
  const ri = Math.max(1, ro - t);
  const ai = Math.max(1, a - t);
  const top = pt(0, yf - ro);
  const outer = pt(a, yf);
  const foot = pt(a - t / 2, yf + t / 2);
  const inner = pt(ai, yf);
  const bottom = pt(0, yf - ri);
  const right: Cubic[] = [
    [pt(K * a, yf - ro), pt(a, yf - K * ro), outer],
    [pt(a, yf + (K * t) / 2), pt(a - t / 2 + (K * t) / 2, yf + t / 2), foot],
    [pt(a - t / 2 - (K * t) / 2, yf + t / 2), pt(ai, yf + (K * t) / 2), inner],
    [pt(ai, yf - K * ri), pt(K * ai, yf - ri), bottom],
  ];
  return mirrored(right, top);
}

/** The arch upside down, its anchors renamed so "top center" is still the top. */
function cup(w: number, h: number, t: number): Outline {
  const up = arch(w, h, t);
  const flipped = mapOutline(up, (p) => pt(p.x, -p.y));
  // Mirroring reversed the direction; walk it backwards, starting from what is now the top center (the arch's inner top).
  const starts = [flipped.start, ...flipped.segs.map((s) => s[2])]; // 9 points, the last equals the first
  const backwards: Cubic[] = [];
  for (let i = flipped.segs.length - 1; i >= 0; i -= 1) {
    const [c1, c2] = flipped.segs[i]!;
    backwards.push([c2, c1, starts[i]!]);
  }
  // backwards starts at the old top (now the bottom center); the new top center is four anchors on.
  const rotated = [...backwards.slice(4), ...backwards.slice(0, 4)];
  return { start: backwards[3]![2], segs: rotated };
}

function splitCubic(p0: Pt, [c1, c2, p3]: Cubic): [Cubic, Cubic] {
  const mid = (a: Pt, b: Pt) => pt((a.x + b.x) / 2, (a.y + b.y) / 2);
  const a = mid(p0, c1);
  const b = mid(c1, c2);
  const c = mid(c2, p3);
  const d = mid(a, b);
  const e = mid(b, c);
  const m = mid(d, e);
  return [
    [a, d, m],
    [e, c, p3],
  ];
}

function star(r: number): Outline {
  // The brand's star: four points, hollow sides. Each side is cut in two at its notch.
  const side = (from: Pt, to: Pt, c1: Pt, c2: Pt) => splitCubic(from, [c1, c2, to]);
  const n = pt(0, -r);
  const e = pt(r, 0);
  const s = pt(0, r);
  const w = pt(-r, 0);
  const segs: Cubic[] = [
    ...side(n, e, pt(0.12 * r, -0.32 * r), pt(0.32 * r, -0.12 * r)),
    ...side(e, s, pt(0.32 * r, 0.12 * r), pt(0.12 * r, 0.32 * r)),
    ...side(s, w, pt(-0.12 * r, 0.32 * r), pt(-0.32 * r, 0.12 * r)),
    ...side(w, n, pt(-0.32 * r, -0.12 * r), pt(-0.12 * r, -0.32 * r)),
  ];
  return { start: n, segs };
}

/** One eye's outline around (0, 0). `side` is -1 for the left eye, 1 for the right (a slanted lid mirrors). */
export function eyeOutline(form: EyeForm, side: -1 | 1): Outline {
  const shape = form.kind === 'pill' ? pill(form.w, form.h, form.lid ?? 0, form.slope ?? 0, side) : form.kind === 'arch' ? arch(form.w, form.h, form.t) : form.kind === 'cup' ? cup(form.w, form.h, form.t) : star(form.r);
  const dy = form.dy ?? 0;
  return dy === 0 ? shape : mapOutline(shape, (p) => pt(p.x, p.y + dy));
}

/**
 * The two eyes as path strings in the brand frame. `scale` enlarges each eye
 * around its own center (small mascots draw bigger, simpler eyes).
 */
export function eyePaths(eyes: Eyes, scale = 1): readonly [string, string] {
  const at = (form: EyeForm, i: 0 | 1) => {
    const c = EYE_CENTERS[i];
    return outlineToPath(mapOutline(eyeOutline(form, i === 0 ? -1 : 1), (p) => pt(c.x + p.x * scale, c.y + p.y * scale)));
  };
  return [at(eyes[0], 0), at(eyes[1], 1)];
}

/** The forms by name. Sizes are in brand frame units; `open` and `wide` are the brand's own. */
export const EYE = {
  open: { kind: 'pill', w: 50.44, h: 90.8 },
  wide: { kind: 'pill', w: 69, h: 108 },
  /** Set on something: the inner ends of the lids come down. */
  keen: { kind: 'pill', w: 56, h: 96, lid: 0.16, slope: -11 },
  /** Surprise: nearly round. */
  round: { kind: 'pill', w: 74, h: 88 },
  /** Working: open, a touch shorter, sweeping left and right. */
  busy: { kind: 'pill', w: 52, h: 84 },
  /** Dull and waiting: half under a level lid. */
  half: { kind: 'pill', w: 54, h: 92, lid: 0.45 },
  /** Sad: the outer ends of the lids hang. */
  sad: { kind: 'pill', w: 50, h: 86, lid: 0.3, slope: 15 },
  /** Worried: wide, the lids just starting to hang. */
  worried: { kind: 'pill', w: 64, h: 106, lid: 0.1, slope: 10 },
  /** The brand's bold happy eye: an arch as thick as a round-capped stroke of 23. */
  happy: { kind: 'arch', w: 77, h: 57.5, t: 23, dy: -3 },
  /** Chin up. */
  proud: { kind: 'arch', w: 74, h: 50, t: 22, dy: -14 },
  /** One eye of a wink. */
  wink: { kind: 'arch', w: 72, h: 44, t: 19, dy: 4 },
  /** Asleep. */
  closed: { kind: 'cup', w: 66, h: 34, t: 15, dy: 16 },
  /** A plain four-point star: what a small, still mascot draws for the star eyes (the moving one shows the brand's spinning stars). */
  star: { kind: 'star', r: 38, dy: -30 },
} as const satisfies Record<string, EyeForm>;

export type EyeName = keyof typeof EYE;
