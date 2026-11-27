// iPhone: swipe in from the left edge to go back (owner, 27 Nov 2026: like WhatsApp, without reaching for the
// back button). Android is left alone: its own back gesture (the system's, from either edge) already reaches
// AppShell through backButton, and a second one at the same edge would fight it.
// Only on a detail screen (something to go back to), never with a sheet open. The screen follows the finger
// (transform only) and casts a soft edge shadow; let go past 30% of the width or with a flick and it leaves to the
// right, then the screen below comes in with the usual pop; otherwise it slides back. Reduced motion: nothing
// follows the finger, the release alone decides. The same thresholds as dragging a sheet down (sheet-motion).

import { useEffect, type RefObject } from 'react';
import { dragEnd, openSheetCount, releaseSpeed } from '@sulo/ui/mobile/sheet-motion';

/** How far in from the left edge a swipe may start (px). */
export const EDGE_PX = 24;
/** Movement before the direction is decided (px): sideways claims the swipe, up or down leaves it to the page. */
export const LOCK_PX = 10;
const SETTLE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const SETTLE_MS = 180;
const SHADOW = '-12px 0 24px -12px rgb(0 0 0 / 0.28)';

/** Whether a touch at `x` may start the swipe. */
export function edgeStarts(x: number, sheetsOpen: number): boolean {
  return sheetsOpen === 0 && x >= 0 && x <= EDGE_PX;
}

/** Which way a move goes once it is past LOCK_PX: 'back' (right, mostly sideways), 'page', or null (too small yet). */
export function edgeDirection(dx: number, dy: number): 'back' | 'page' | null {
  if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return null;
  return dx > 0 && Math.abs(dx) > Math.abs(dy) ? 'back' : 'page';
}

export function useEdgeBack(target: RefObject<HTMLElement | null>, enabled: boolean, onBack: () => void): void {
  useEffect(() => {
    const el = target.current;
    if (!el || !enabled) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let start: { x: number; y: number } | null = null;
    let claimed = false;
    let dx = 0;
    let samples: { t: number; y: number }[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clear = () => {
      el.style.transition = '';
      el.style.transform = '';
      el.style.boxShadow = '';
      el.style.willChange = '';
    };
    const reset = () => {
      start = null;
      claimed = false;
      dx = 0;
      samples = [];
    };
    const settle = (to: number, ms: number, ease: string, then: () => void) => {
      el.style.transition = `transform ${ms}ms ${ease}`;
      el.style.transform = `translateX(${to}px)`;
      timer = setTimeout(then, ms + 20);
    };

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (e.touches.length !== 1 || !t || timer !== null || !edgeStarts(t.clientX, openSheetCount())) return;
      start = { x: t.clientX, y: t.clientY };
      samples = [{ t: e.timeStamp, y: 0 }];
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!start || !t) return;
      const mx = t.clientX - start.x;
      if (!claimed) {
        const way = edgeDirection(mx, t.clientY - start.y);
        if (way === null) return;
        if (way === 'page') return reset();
        claimed = true;
        if (!reduce) {
          el.style.transition = 'none';
          el.style.willChange = 'transform';
          el.style.boxShadow = SHADOW;
        }
      }
      // The page does not scroll under a sideways swipe.
      e.preventDefault();
      dx = Math.max(0, mx);
      samples.push({ t: e.timeStamp, y: dx });
      if (samples.length > 8) samples.shift();
      if (!reduce) el.style.transform = `translateX(${dx}px)`;
    };
    const onEnd = () => {
      if (!start || !claimed) return reset();
      const width = el.clientWidth || window.innerWidth;
      const end = dragEnd(dx, releaseSpeed(samples), width, width);
      reset();
      if (reduce) {
        if (end.close) onBack();
        return;
      }
      if (!end.close) {
        settle(0, SETTLE_MS, SETTLE, () => {
          timer = null;
          clear();
        });
        return;
      }
      settle(width, end.durationMs, 'cubic-bezier(0.4, 0, 1, 1)', () => {
        onBack();
        // The screen below renders first, then the box comes back to its place (no frame of the old one).
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            timer = null;
            clear();
          }),
        );
      });
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      if (timer !== null) clearTimeout(timer);
      clear();
    };
  }, [target, enabled, onBack]);
}
