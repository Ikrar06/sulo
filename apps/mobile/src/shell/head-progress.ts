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
/** s: the bar's sticky rise (56 -> 48 px) over the first 8 px; the title and buttons are offset by it so they stay put. */
export const HEAD_S_RANGE = [0, 8] as const;
/** The title at p = 1: 18/26. */
export const HEAD_SMALL_SCALE = 18 / 26;

/** clamp((scrollTop - from) / (to - from), 0, 1); overscroll above the top gives 0, never more than full size. */
export function headProgress(scrollTop: number, range: readonly [number, number]): number {
  const [from, to] = range;
  if (!Number.isFinite(scrollTop) || to <= from) return 0;
  return Math.min(1, Math.max(0, (scrollTop - from) / (to - from)));
}

/** The scroll offset that counts: 0 whenever there is nothing to scroll (the header then stays large). */
export function effectiveScroll(scrollTop: number, scrollHeight: number, clientHeight: number): number {
  return scrollHeight > clientHeight + 1 ? Math.max(0, scrollTop) : 0;
}

/** Once at start: CSS scroll-driven animations, unless motion is reduced (then the JS path, same look). */
export function useCssScrollTimeline(): boolean {
  if (typeof CSS === 'undefined' || typeof matchMedia !== 'function') return false;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return CSS.supports('animation-timeline: scroll()') && CSS.supports('timeline-scope: --m-main');
}
