// The header follows the finger (M8c.3): a progress from the scroll offset,
// no threshold and no timed animation. p drives the main screens' title
// (26 -> 18, moving up to the buttons' line) and the top fade; q drives
// Ringkasan's small title over the last part of its greeting's height.
// CSS scroll-driven animations compute the same values where supported
// (styles.css); otherwise a passive scroll listener writes them once per
// frame (AppShell). Never setState per frame.

/** p: 0 at the top, 1 once the large title's row (56 px) has scrolled away. */
export const HEAD_P_RANGE = [0, 56] as const;
/** q: Ringkasan's small title fades in over 72-120 px. */
export const HEAD_Q_RANGE = [72, 120] as const;
/** The title at p = 1: 18/26. */
export const HEAD_SMALL_SCALE = 18 / 26;

/** clamp((scrollTop - from) / (to - from), 0, 1); overscroll above the top gives 0, never more than full size. */
export function headProgress(scrollTop: number, range: readonly [number, number]): number {
  const [from, to] = range;
  if (!Number.isFinite(scrollTop) || to <= from) return 0;
  return Math.min(1, Math.max(0, (scrollTop - from) / (to - from)));
}

/** Once at start: CSS scroll-driven animations, unless motion is reduced (then the JS path, same look). */
export function useCssScrollTimeline(): boolean {
  if (typeof CSS === 'undefined' || typeof matchMedia !== 'function') return false;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return CSS.supports('animation-timeline: scroll()') && CSS.supports('timeline-scope: --m-main');
}
