// The one onboarding mascot (M8c.2). A single element on the top layer from
// the splash until it lands on Ringkasan: it is never unmounted between
// screens and there is never a second one. Each screen marks where the
// mascot belongs with <MascotSpot size>; this layer measures that spot after
// layout and moves there with FLIP (translate + scale on one element, drawn
// at 120 px). Expressions come from the screen through useMascotCue.

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { MascotState } from '@sulo/core/view/popup-view';
import { Mascot } from '@sulo/ui/mascot/Mascot';
import { EASE_OUT, flip, MS, reducedMotion, type Box } from './motion';

/** The mascot is drawn at this size and scaled to each spot. */
export const MASCOT_BASE = 120;

export interface MascotCue {
  state: MascotState;
  /** Bump for a small hop (Mascot's poke). */
  poke?: number;
  /** Bump to celebrate once. */
  celebrate?: number;
}

const CueContext = createContext<(cue: MascotCue) => void>(() => undefined);

/** A screen sets the mascot's expression; the latest call wins. */
export function useMascotCue(cue: MascotCue): void {
  const set = useContext(CueContext);
  const { state, poke = 0, celebrate = 0 } = cue;
  useEffect(() => set({ state, poke, celebrate }), [set, state, poke, celebrate]);
}

/** Where the mascot sits on this screen: an empty box of its size (the mascot itself is on the top layer). */
export function MascotSpot({ size, className = '', target = 'onboarding' }: { size: number; className?: string; target?: string }) {
  return <div aria-hidden="true" data-mascot-spot={target} className={`shrink-0 ${className}`} style={{ width: size, height: size }} />;
}

function measure(selector: string): Box | null {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0) return null;
  return { x: r.left, y: r.top, size: r.width };
}

/**
 * The top layer and the cue provider. `spotKey` changes with the screen (and
 * anything that moves the spot); `selector` picks the spot to follow (the
 * Ringkasan hero for the landing). `onArrived` fires after a move ends.
 */
export function FlyingMascotLayer({ spotKey, selector = '[data-mascot-spot="onboarding"]', duration = MS.mascotMove, hidden = false, onArrived, children }: { spotKey: string; selector?: string; duration?: number; hidden?: boolean; onArrived?: () => void; children: ReactNode }) {
  const [cue, setCue] = useState<MascotCue>({ state: 'onboarding' });
  const el = useRef<HTMLDivElement | null>(null);
  const at = useRef<Box | null>(null);
  const arrived = useRef(onArrived);
  arrived.current = onArrived;
  const set = useCallback((c: MascotCue) => setCue((p) => (p.state === c.state && p.poke === c.poke && p.celebrate === c.celebrate ? p : c)), []);

  const move = useCallback(
    (animate: boolean) => {
      const node = el.current;
      const to = measure(selector);
      if (!node || !to) return;
      const from = at.current;
      if (from && from.x === to.x && from.y === to.y && from.size === to.size) return;
      const { keyframes, end } = flip(from, to, MASCOT_BASE);
      node.getAnimations().forEach((a) => a.cancel());
      node.style.transform = end;
      at.current = to;
      if (!animate) return arrived.current?.();
      const reduced = reducedMotion();
      const a = node.animate(reduced ? [{ opacity: 0.4 }, { opacity: 1 }] : keyframes, { duration: reduced ? MS.reduced : duration, easing: EASE_OUT });
      a.onfinish = () => arrived.current?.();
    },
    [selector, duration],
  );

  // A new screen: measure after its layout (two frames, so fonts and the stage have settled).
  useLayoutEffect(() => {
    let r2 = 0;
    const r1 = requestAnimationFrame(() => (r2 = requestAnimationFrame(() => move(true))));
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [spotKey, move]);

  // The keyboard or a rotation moves the spot: follow without a flight.
  useEffect(() => {
    const onResize = () => move(false);
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
  }, [move]);

  return (
    <CueContext.Provider value={set}>
      {children}
      <div ref={el} aria-hidden="true" className="pointer-events-none fixed top-0 left-0 z-50 origin-top-left" style={{ width: MASCOT_BASE, height: MASCOT_BASE, opacity: hidden ? 0 : 1, transform: 'translate(-200px, -200px)' }}>
        <Mascot state={cue.state} size={MASCOT_BASE} poke={cue.poke ?? 0} celebrate={cue.celebrate ?? 0} effects={false} />
      </div>
    </CueContext.Provider>
  );
}
