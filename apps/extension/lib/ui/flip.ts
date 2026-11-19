// FLIP for lists (Tahap 2, audit b1): when rows above leave or arrive, the
// rows that stay glide from where they were to where they are, with a
// transform only (180 ms), instead of jumping. Rows carry data-flip-key.
// Nothing moves under prefers-reduced-motion. No layout animation at all.

import { useLayoutEffect, useRef, type RefObject } from 'react';

const DURATION_MS = 180;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useFlip(container: RefObject<HTMLElement | null>): void {
  const tops = useRef(new Map<string, number>());
  // Every render: compare each row's top with the last one, then remember.
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    // Measured inside the list, so scrolling the page never counts as a move.
    const origin = root.getBoundingClientRect().top;
    const rows = [...root.querySelectorAll<HTMLElement>('[data-flip-key]')];
    const next = new Map<string, number>();
    for (const row of rows) {
      const key = row.dataset.flipKey!;
      const top = row.getBoundingClientRect().top - origin;
      next.set(key, top);
      const before = tops.current.get(key);
      if (before === undefined || reduced() || typeof row.animate !== 'function') continue;
      const dy = before - top;
      if (Math.abs(dy) < 1) continue;
      row.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: DURATION_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
    }
    tops.current = next;
  });
}
