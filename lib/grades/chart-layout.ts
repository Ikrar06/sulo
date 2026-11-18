// Layout of the semester GPA chart's interaction (M7.1). Pure, tested in
// tests/chart-layout.test.ts: which point a pointer is over, where the one
// tooltip goes, and where each value label sits.

/**
 * The point whose column holds `x`: each point owns a vertical band one
 * x step wide, centred on it. null outside every band (the hover resets).
 */
export function columnAt(x: number, xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const half = xs.length === 1 ? Infinity : (xs[1]! - xs[0]!) / 2;
  const i = xs.findIndex((px) => Math.abs(x - px) <= half);
  return i === -1 ? null : i;
}

/** Bands for the hover areas: left edge and width per point, inside [plotLeft, plotRight]. */
export function columns(xs: readonly number[], plotLeft: number, plotRight: number): { left: number; width: number }[] {
  return xs.map((px, i) => {
    const left = i === 0 ? plotLeft : (xs[i - 1]! + px) / 2;
    const right = i === xs.length - 1 ? plotRight : (px + xs[i + 1]!) / 2;
    return { left, width: Math.max(0, right - left) };
  });
}

export interface TooltipBox {
  left: number;
  top: number;
  placement: 'above' | 'below';
}

/**
 * The single tooltip: centred above the point and clear of its value label
 * (30 px), shifted inside the card near either edge, and below the point
 * (12 px) when there is no room above.
 */
export function tooltipPosition(point: { x: number; y: number }, size: { width: number; height: number }, containerWidth: number, gap = { above: 30, below: 12 }): TooltipBox {
  const left = Math.max(0, Math.min(containerWidth - size.width, point.x - size.width / 2));
  const above = point.y - gap.above - size.height;
  return above >= 0 ? { left, top: above, placement: 'above' } : { left, top: point.y + gap.below, placement: 'below' };
}

/** Width a value label like "3.95" takes at 12 px, with a little air. */
export const LABEL_W = 34;
const LABEL_H = 16;

/**
 * Value labels go above their points; when two neighbours' labels would
 * touch, the lower point's label moves below its point.
 */
export function labelPlacements(points: readonly { x: number; y: number }[]): ('above' | 'below')[] {
  const out: ('above' | 'below')[] = points.map(() => 'above');
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const close = Math.abs(a.x - b.x) < LABEL_W && Math.abs(a.y - b.y) < LABEL_H;
    if (!close) continue;
    // The lower point (larger y) gets its label below.
    if (b.y >= a.y) out[i] = 'below';
    else out[i - 1] = 'below';
  }
  return out;
}
