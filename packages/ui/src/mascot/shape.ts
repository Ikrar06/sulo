// The mascot's body as points: the two flame layers and the face, parsed
// once from the brand shapes (shapes.generated.ts) into cubic segments, so
// one bend (warp.ts) can move every control point of all three together.
// Pure: no DOM.

import { MASCOT_SHAPES } from './shapes.generated';

export interface Pt {
  readonly x: number;
  readonly y: number;
}
/** One cubic segment: two control points and its end. */
export type Cubic = readonly [Pt, Pt, Pt];
/** A closed outline: where it starts and its cubic segments. */
export interface Outline {
  readonly start: Pt;
  readonly segs: readonly Cubic[];
}

/** The brand frame: 510 x 512, the flame standing on its bottom edge. */
export const FRAME = { width: 510, height: 512 } as const;
/** Bottom center: everything squashes, stretches and bends from here. */
export const BASE: Pt = { x: 245, y: 512 };
/** The view box the mascot is drawn in (room for jumps, sparks and the shadow). */
export const VIEW_BOX = { x: -40, y: -60, width: 590, height: 600 } as const;
/** Midpoint between the eyes. */
export const EYES_CENTER: Pt = { x: 244.65, y: 406.07 };
/** Each eye's center, left then right. */
export const EYE_CENTERS: readonly [Pt, Pt] = [
  { x: 186.64, y: 406.07 },
  { x: 302.66, y: 406.07 },
];
/** How far the eyes may travel from rest (15% of the face's width, 10% of its height). */
export const GLANCE = { x: 50.7, y: 22.2 } as const;

const NUM = /-?\d*\.?\d+(?:e-?\d+)?/gi;

/** Parses an absolute path made of M, C, L, H, V and Z into cubic segments (lines become flat cubics). */
export function parseOutline(d: string): Outline {
  const commands = d.match(/[MCLHVZ][^MCLHVZ]*/gi);
  if (!commands) throw new Error('parseOutline: empty path');
  let start: Pt | null = null;
  let at: Pt = { x: 0, y: 0 };
  const segs: Cubic[] = [];
  const line = (to: Pt) => {
    segs.push([
      { x: at.x + (to.x - at.x) / 3, y: at.y + (to.y - at.y) / 3 },
      { x: at.x + ((to.x - at.x) * 2) / 3, y: at.y + ((to.y - at.y) * 2) / 3 },
      to,
    ]);
    at = to;
  };
  for (const command of commands) {
    const type = command[0]!;
    const n = (command.slice(1).match(NUM) ?? []).map(Number);
    if (type === 'M') {
      at = { x: n[0]!, y: n[1]! };
      start = at;
    } else if (type === 'C') {
      for (let i = 0; i + 5 < n.length; i += 6) {
        const end = { x: n[i + 4]!, y: n[i + 5]! };
        segs.push([{ x: n[i]!, y: n[i + 1]! }, { x: n[i + 2]!, y: n[i + 3]! }, end]);
        at = end;
      }
    } else if (type === 'L') {
      for (let i = 0; i + 1 < n.length; i += 2) line({ x: n[i]!, y: n[i + 1]! });
    } else if (type === 'H') {
      for (const x of n) line({ x, y: at.y });
    } else if (type === 'V') {
      for (const y of n) line({ x: at.x, y });
    } else if (type !== 'Z' && type !== 'z') {
      throw new Error(`parseOutline: unsupported command ${type}`);
    }
  }
  if (!start) throw new Error('parseOutline: no start point');
  return { start, segs };
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** An outline back to a path string, one decimal: enough at any size the mascot is drawn. */
export function outlineToPath(o: Outline): string {
  let d = `M${r1(o.start.x)} ${r1(o.start.y)}`;
  for (const [a, b, c] of o.segs) d += `C${r1(a.x)} ${r1(a.y)} ${r1(b.x)} ${r1(b.y)} ${r1(c.x)} ${r1(c.y)}`;
  return `${d}Z`;
}

/** Moves every point of an outline through `f`. */
export function mapOutline(o: Outline, f: (p: Pt) => Pt): Outline {
  return { start: f(o.start), segs: o.segs.map(([a, b, c]) => [f(a), f(b), f(c)] as const) };
}

const mix = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const move = (p: Pt, dx: number, dy: number): Pt => ({ x: p.x + dx, y: p.y + dy });

/** Where the cubic that runs from `from` is at `t`. */
function pointOn(from: Pt, [c1, c2, to]: Cubic, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * from.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * to.x,
    y: u * u * u * from.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * to.y,
  };
}

/** Splits the cubic that runs from `from` at `t` (de Casteljau): two cubics that draw exactly the same curve. */
function splitCubic(from: Pt, [c1, c2, to]: Cubic, t: number): readonly [Cubic, Cubic] {
  const a = mix(from, c1, t);
  const b = mix(c1, c2, t);
  const c = mix(c2, to, t);
  const d = mix(a, b, t);
  const e = mix(b, c, t);
  return [
    [a, d, mix(d, e, t)],
    [e, c, to],
  ];
}

const startOf = (o: Outline, index: number): Pt => (index === 0 ? o.start : o.segs[index - 1]![2]);

/** Where an outline passes closest to a point: which segment, how far along it, and how near. */
export function nearestOn(o: Outline, p: Pt): { readonly index: number; readonly t: number; readonly distance: number } {
  const STEPS = 200;
  let best = { index: 0, t: 0, distance: Infinity };
  o.segs.forEach((seg, index) => {
    const from = startOf(o, index);
    const far = (t: number) => {
      const q = pointOn(from, seg, t);
      return Math.hypot(q.x - p.x, q.y - p.y);
    };
    for (let i = 0; i <= STEPS; i += 1) {
      const distance = far(i / STEPS);
      if (distance < best.distance) best = { index, t: i / STEPS, distance };
    }
    if (best.index !== index) return;
    // Narrow it down between the neighbouring samples.
    let lo = Math.max(0, best.t - 1 / STEPS);
    let hi = Math.min(1, best.t + 1 / STEPS);
    for (let i = 0; i < 40; i += 1) {
      const a = lo + (hi - lo) / 3;
      const b = hi - (hi - lo) / 3;
      if (far(a) < far(b)) hi = b;
      else lo = a;
    }
    const t = (lo + hi) / 2;
    if (far(t) <= best.distance) best = { index, t, distance: far(t) };
  });
  return best;
}

/** The same outline with one segment split in two at `t`: nothing it draws changes. */
function cut(o: Outline, index: number, t: number): Outline {
  const [first, second] = splitCubic(startOf(o, index), o.segs[index]!, t);
  return { start: o.start, segs: [...o.segs.slice(0, index), first, second, ...o.segs.slice(index + 1)] };
}

/** The face's two lower corners (right, then left): the anchors where its outline turns sharply. */
export function faceCorners(face: Outline): readonly [Pt, Pt] {
  const found: Pt[] = [];
  face.segs.forEach(([, c2, to], i) => {
    const next = face.segs[(i + 1) % face.segs.length]!;
    const turn = Math.atan2(to.y - c2.y, to.x - c2.x) - Math.atan2(next[0].y - to.y, next[0].x - to.x);
    // The corners turn by about 25 degrees; every other anchor is smooth.
    if (Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))) > 0.2) found.push(to);
  });
  if (found.length !== 2) throw new Error(`faceCorners: expected two corners, found ${found.length}`);
  const [a, b] = found as [Pt, Pt];
  return a.x > b.x ? [a, b] : [b, a];
}

// The face's lower edge is the flame's own lower edge (the brand draws the
// face cut to the flame). Two edges drawn on one line leave a hairline of
// the flame showing between them, because each is smoothed against what is
// already under it; it is plainest on a dark ground. The old mascot drew the
// flame and a larger face together and masked them once, which costs an
// off-screen pass every time it is redrawn. Here the lower edge is drawn by
// the face alone instead: the part of each flame layer that runs along it is
// tucked in behind the face, where it cannot be seen. Nothing visible moves:
// the face is the brand's, and the flame is cut exactly at the face's corners.

/** How far inside the face the tucked edges turn, along the corner's own diagonal. */
const TUCK = { x: 18, y: 24 } as const;

/**
 * The back flame (the whole silhouette), its run under the face tucked in:
 * from the face's right corner it turns up into the face, crosses behind it,
 * and comes back out at the left corner.
 */
function tuckBack(back: Outline, [right, left]: readonly [Pt, Pt]): Outline {
  const r = nearestOn(back, right);
  const withRight = cut(back, r.index, r.t);
  const l = nearestOn(withRight, left);
  if (l.index <= r.index) throw new Error('tuckBack: the silhouette no longer runs right to left under the face');
  const o = cut(withRight, l.index, l.t);
  // Segments r.index + 1 .. l.index ran along the face's lower edge.
  const from = o.segs[r.index]![2];
  const to = o.segs[l.index]![2];
  const behind: Pt = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 40 };
  return {
    start: o.start,
    segs: [
      ...o.segs.slice(0, r.index + 1),
      [move(from, -TUCK.x, -TUCK.y), move(behind, 60, 0), behind],
      [move(behind, -60, 0), move(to, TUCK.x, -TUCK.y), to],
      ...o.segs.slice(l.index + 1),
    ],
  };
}

/**
 * The front flame: its seam with the back flame comes down behind the face
 * and met the lower edge a little inside the left corner. It now stops short
 * of the edge and reaches the corner from inside the face. The seam is the
 * brand's down to well behind the face (the last tenth of that segment).
 */
function tuckFront(front: Outline, face: Outline, left: Pt): Outline {
  // The anchor that sat on the face's lower edge: the lowest one.
  const low = front.segs.reduce((best, seg, i) => (seg[2].y > front.segs[best]![2].y ? i : best), 0);
  const seamCut = cut(front, low, 0.9);
  // `low` is now the untouched nine tenths of the seam; low + 1 its end; low + 2 ran from the anchor up the left side.
  const corner = nearestOn(seamCut, left);
  if (corner.index !== low + 2) throw new Error('tuckFront: the front flame no longer passes the face corner after its lowest point');
  const o = cut(seamCut, corner.index, corner.t);
  const turn = o.segs[low]![2];
  if (nearestOn(face, turn).distance < 12) throw new Error('tuckFront: the seam is not behind the face where it is cut');
  const at = o.segs[low + 2]![2];
  const inside = move(at, 12, -16);
  return {
    start: o.start,
    segs: [
      ...o.segs.slice(0, low + 1),
      [o.segs[low + 1]![0], move(inside, 0, -22), inside],
      [mix(inside, at, 1 / 3), mix(inside, at, 2 / 3), at],
      ...o.segs.slice(low + 3),
    ],
  };
}

const FACE = parseOutline(MASCOT_SHAPES.face);
const CORNERS = faceCorners(FACE);

/** The brand's three shapes exactly as drawn in the brand files, for checks. */
export const BRAND_BODY = {
  back: parseOutline(MASCOT_SHAPES.flame[0]!),
  front: parseOutline(MASCOT_SHAPES.flame[1]!),
  face: FACE,
} as const;

/** The body at rest: back flame, front flame, face. What shows is the brand's three shapes; what the face hides of the flame's lower edge is tucked in (see above). */
export const BODY = {
  back: tuckBack(BRAND_BODY.back, CORNERS),
  front: tuckFront(BRAND_BODY.front, FACE, CORNERS[1]),
  face: FACE,
} as const;

export const GRADIENTS = MASCOT_SHAPES.gradients;
