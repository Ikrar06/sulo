// Pull to update: drag down from the top of a screen past a threshold and
// let go. Touch only, no dependency. Reduced motion skips the easing.

import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { RefreshIcon } from '@sulo/ui/icons';

/** How far to pull (px, after damping) before letting go updates. */
export const PULL_THRESHOLD = 64;
const MAX_PULL = 96;

/** Finger travel to shown distance: half the travel, up to MAX_PULL (so the threshold needs 128 px of pull). */
export function damp(dy: number): number {
  return dy <= 0 ? 0 : Math.min(MAX_PULL, dy / 2);
}

export function PullToRefresh({ children, onRefresh, disabled, labels, scroller }: { children: ReactNode; onRefresh: () => void; disabled: boolean; labels: { pull: string; release: string }; scroller: RefObject<HTMLElement | null> }) {
  const start = useRef<number | null>(null);
  const [pull, setPull] = useState(0);

  // React touch events also bubble up from portals (a bottom sheet opened on
  // this screen): only touches on the screen itself pull.
  const onScreen = (e: React.TouchEvent) => e.currentTarget.contains(e.target as Node);
  const onStart = (e: React.TouchEvent) => {
    if (disabled || !onScreen(e) || (scroller.current?.scrollTop ?? 0) > 0) return;
    start.current = e.touches[0]!.clientY;
  };
  // The pull, for anything that follows it (Ringkasan's mascot dips up to 10 px).
  const share = (px: number) => document.documentElement.style.setProperty('--m-pull-y', `${Math.min(10, (px / PULL_THRESHOLD) * 10).toFixed(1)}px`);
  const onMove = (e: React.TouchEvent) => {
    if (start.current === null) return;
    const dy = e.touches[0]!.clientY - start.current;
    const next = dy > 0 ? damp(dy) : 0;
    setPull(next);
    share(next);
  };
  const onEnd = () => {
    if (start.current === null) return;
    start.current = null;
    if (pull >= PULL_THRESHOLD) onRefresh();
    setPull(0);
    share(0);
  };

  const ready = pull >= PULL_THRESHOLD;
  return (
    <div onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} onTouchCancel={onEnd}>
      <div aria-hidden={pull === 0} className="flex items-end justify-center overflow-hidden text-m12 text-muted-foreground transition-[height] duration-150 motion-reduce:transition-none" style={{ height: pull }}>
        {pull > 8 && (
          <span className="mb-2 inline-flex items-center gap-2" role="status">
            <RefreshIcon className="size-4" style={{ transform: `rotate(${Math.round((pull / PULL_THRESHOLD) * 270)}deg)` }} />
            {ready ? labels.release : labels.pull}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
