// Mascot geometry in SVG units of the 510x512 frame (brand assets).

/** Eye centers, from eyes-open.svg (rect centers). */
export const EYE_CENTERS = [
  { x: 186.64, y: 406.07 },
  { x: 302.66, y: 406.07 },
] as const;

/**
 * Centers of the star eyes (eyes-star.svg), in markup order: each star spins
 * around its own center, which sits higher than the regular eyes.
 */
export const STAR_CENTERS = [
  { x: 302, y: 374 },
  { x: 190, y: 374 },
] as const;

/** Stroke width of the dizzy spirals, in mascot units. */
export const SPIRAL_STROKE = 8;

/**
 * Archimedean spiral around (cx, cy), drawn as a path (dizzy eyes). Computed
 * once; the rig turns the eyes.
 */
export function spiralPath(cx: number, cy: number, maxRadius = 25, turns = 2.25, steps = 48): string {
  const total = turns * 2 * Math.PI;
  const points: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * total;
    const r = (t / total) * maxRadius;
    points.push(`${(cx + r * Math.cos(t)).toFixed(1)} ${(cy + r * Math.sin(t)).toFixed(1)}`);
  }
  return `M${points.join(' L')}`;
}

/** A small "z" drawn as a stroke, so no font is needed. */
export const Z_PATH = 'M-10 -10 L10 -10 L-10 10 L10 10';
