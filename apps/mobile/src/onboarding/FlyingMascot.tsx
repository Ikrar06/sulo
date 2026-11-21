// The one onboarding mascot (M8c.2), the main character of every screen. A
// single element on the top layer from the splash until it lands on
// Ringkasan: never unmounted between screens, never a second one. Each
// screen marks where it stands with <MascotSpot>; this layer measures that
// spot after layout and moves there with FLIP (translate + scale on one
// element drawn at 176 px).
//
// Screens direct it through useMascot(): a base expression, a short flash
// of another one, a look toward an element that just appeared or was
// tapped, a hop. A tap on the mascot itself is a small hop and a blink.
// Expressions are core's MASCOT_EXPRESSIONS.

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MASCOT_EXPRESSIONS, type MascotExpression, type MascotExpressionSpec } from '@sulo/core/dashboard/mascot-mood';
import { Mascot } from '@sulo/ui/mascot/Mascot';
import { dur } from '../perf';
import { EASE_OUT, flip, MS, reducedMotion, type Box } from './motion';

/** The mascot is drawn at this size and scaled to each spot. */
export const MASCOT_BASE = 176;
const POKE_EVERY_MS = 1200;
/** No variant still asks the component for the onboarding's extras (it blinks under reduced motion). */
const ONBOARDING_VARIANT = undefined;

export interface MascotDirector {
  /** The screen's resting expression. */
  express: (e: MascotExpression) => void;
  /** Another expression for a moment, then back to the resting one. */
  flash: (e: MascotExpression, ms?: number) => void;
  /** Look toward an element (or a point of the viewport) for a moment; null releases the gaze. */
  lookAt: (target: Element | { x: number; y: number } | null, ms?: number) => void;
  hop: () => void;
  celebrate: () => void;
}

const noop = () => undefined;
const DirectorContext = createContext<MascotDirector>({ express: noop, flash: noop, lookAt: noop, hop: noop, celebrate: noop });
export const useMascot = () => useContext(DirectorContext);

/** A screen's resting expression, set while it is mounted. */
export function useExpression(e: MascotExpression): void {
  const { express } = useMascot();
  useEffect(() => express(e), [express, e]);
}

/** Where the mascot stands on this screen: an empty box of its size (the mascot itself is on the top layer). */
export function MascotSpot({ size, className = '', target = 'onboarding' }: { size: number; className?: string; target?: string }) {
  return <div aria-hidden="true" data-mascot-spot={target} data-onb-piece="" className={`shrink-0 ${className}`} style={{ width: size, height: size }} />;
}

/** The live spot: never one inside a screen that is sliding away. */
function measure(selector: string): Box | null {
  const el = [...document.querySelectorAll<HTMLElement>(selector)].find((n) => !n.closest('[data-onb-leaving]'));
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0) return null;
  // The screen may still be sliding in: the spot's resting place is what counts, not where it is mid-slide.
  const content = el.closest<HTMLElement>('[data-onb-content]');
  const t = content ? getComputedStyle(content).transform : 'none';
  const m = t && t !== 'none' ? new DOMMatrixReadOnly(t) : null;
  return { x: r.left - (m?.m41 ?? 0), y: r.top - (m?.m42 ?? 0), size: r.width };
}

/** The spot was scrolled out of its list (a short phone with the keyboard up): the mascot steps out instead of floating over the bars. */
function scrolledOut(selector: string): boolean {
  const el = [...document.querySelectorAll<HTMLElement>(selector)].find((n) => !n.closest('[data-onb-leaving]'));
  const scroller = el?.closest<HTMLElement>('.onb-scroll');
  if (!el || !scroller) return false;
  const r = el.getBoundingClientRect();
  const s = scroller.getBoundingClientRect();
  return r.top < s.top - r.height * 0.25 || r.bottom > s.bottom + r.height * 0.25;
}

/**
 * The top layer and the director. `spotKey` changes with the screen (and
 * anything that moves the spot); `selector` picks the spot to follow (the
 * Ringkasan hero for the landing). `onArrived` fires after a move ends.
 */
export function FlyingMascotLayer({ spotKey, selector = '[data-mascot-spot="onboarding"]', duration = MS.mascotMove, onArrived, forced, children }: { spotKey: string; selector?: string; duration?: number; onArrived?: () => void; /** The landing: this expression, whatever the screens say. */ forced?: MascotExpressionSpec; children: ReactNode }) {
  const [base, setBase] = useState<MascotExpression>('neutral');
  const [flashed, setFlashed] = useState<MascotExpression | null>(null);
  const [gaze, setGaze] = useState<{ x: number; y: number } | null>(null);
  const [poke, setPoke] = useState(0);
  const [party, setParty] = useState(0);
  const el = useRef<HTMLDivElement | null>(null);
  const at = useRef<Box | null>(null);
  const arrived = useRef(onArrived);
  arrived.current = onArrived;
  /** Starts watching the current screen's spot for a change of its own size (set by the follow effect below). */
  const watchSpot = useRef<() => void>(() => undefined);
  const timers = useRef<{ flash: number; gaze: number }>({ flash: 0, gaze: 0 });
  const lastPoke = useRef(0);

  const director = useMemo<MascotDirector>(
    () => ({
      express: (e) => setBase(e),
      flash: (e, ms = 900) => {
        window.clearTimeout(timers.current.flash);
        setFlashed(e);
        timers.current.flash = window.setTimeout(() => setFlashed(null), ms);
      },
      lookAt: (target, ms = 1100) => {
        window.clearTimeout(timers.current.gaze);
        if (target === null) return setGaze(null);
        const me = at.current;
        if (!me) return;
        const r = target instanceof Element ? target.getBoundingClientRect() : null;
        const tx = r ? r.left + r.width / 2 : (target as { x: number }).x;
        const ty = r ? r.top + r.height / 2 : (target as { y: number }).y;
        const dx = tx - (me.x + me.size / 2);
        const dy = ty - (me.y + me.size * 0.72);
        const d = Math.hypot(dx, dy) || 1;
        // Full travel from about one mascot away.
        const k = Math.min(1, d / me.size);
        setGaze({ x: (dx / d) * k, y: (dy / d) * k });
        if (ms > 0) timers.current.gaze = window.setTimeout(() => setGaze(null), ms);
      },
      hop: () => setPoke((n) => n + 1),
      celebrate: () => setParty((n) => n + 1),
    }),
    [],
  );
  // pnpm mobile:web only: the layout check drives every expression through this.
  useEffect(() => {
    if (!(__SULO_WEB_FAKE__ && import.meta.env.MODE === 'web')) return;
    (window as unknown as { __suloMascot?: MascotDirector }).__suloMascot = director;
  }, [director]);
  useEffect(() => {
    const t = timers.current;
    return () => {
      window.clearTimeout(t.flash);
      window.clearTimeout(t.gaze);
    };
  }, []);

  const move = useCallback(
    (animate: boolean) => {
      const node = el.current;
      const to = measure(selector);
      if (!node || !to) return;
      // A spot again (after the nickname screen let it step out): it shows.
      node.style.opacity = scrolledOut(selector) ? '0' : '1';
      const last = at.current;
      if (last && Math.abs(last.x - to.x) < 0.5 && Math.abs(last.y - to.y) < 0.5 && Math.abs(last.size - to.size) < 0.5) return;
      // A flight always starts from where the mascot is on screen right now,
      // also in the middle of another flight: never a jump.
      const flying = node.getAnimations().length > 0;
      const live = node.getBoundingClientRect();
      const from: Box | null = last ? (flying ? { x: live.left, y: live.top, size: live.width } : last) : null;
      const { keyframes, end } = flip(from, to, MASCOT_BASE);
      node.getAnimations().forEach((a) => a.cancel());
      node.style.transform = end;
      at.current = to;
      const reduced = reducedMotion();
      // A correction (the keyboard, a list that grew): a short glide, not a snap.
      const far = !from || Math.hypot(from.x - to.x, from.y - to.y) > 2 || Math.abs(from.size - to.size) > 2;
      if (!far) return arrived.current?.();
      // While it flies the mascot's own sway and breathing hold still: the
      // flight is then one texture moved by the compositor, instead of an
      // animated SVG painted again at a new size every frame.
      node.classList.add('onb-flying');
      const a = node.animate(reduced ? [{ opacity: 0.6 }, { opacity: 1 }] : keyframes, { duration: reduced ? MS.reduced : dur(animate ? duration : 200), easing: EASE_OUT });
      const land = () => node.classList.remove('onb-flying');
      a.oncancel = land;
      a.onfinish = () => {
        land();
        arrived.current?.();
      };
    },
    [selector, duration],
  );

  // A new screen: measure after its layout (two frames, so fonts and the scene's scale have settled).
  useLayoutEffect(() => {
    let r2 = 0;
    const r1 = requestAnimationFrame(
      () =>
        (r2 = requestAnimationFrame(() => {
          move(true);
          watchSpot.current();
        })),
    );
    // Once more when the screen has settled (fonts, the scene's scale): a correction glides.
    const settle = window.setTimeout(() => move(false), 700);
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      window.clearTimeout(settle);
    };
  }, [spotKey, move]);

  // The keyboard, a rotation or a list growing moves the spot: follow without a flight.
  useEffect(() => {
    // Not during a flight: the flight already knows where it is going.
    const follow = () => {
      const node = el.current;
      if (!node) return;
      watch();
      // No spot on this screen just now (the nickname screen with the keyboard up), or scrolled out of view: the mascot steps out.
      node.style.opacity = scrolledOut(selector) || !measure(selector) ? '0' : '1';
      if (node.getAnimations().length === 0) move(false);
      // The spot may have moved on while the mascot was gliding (Android's keyboard arrives in steps): look again when it lands.
      else void Promise.allSettled(node.getAnimations().map((a) => a.finished)).then(soon);
    };
    // Only when something can really have moved the spot (no polling: measuring forces a layout).
    let raf = 0;
    // A glide's promise can settle after this effect is gone (the landing on Ringkasan changes the spot): then it does nothing.
    let live = true;
    const soon = () => {
      if (!live) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(follow);
    };
    // The spot's own box can change after the last resize event: the nickname screen makes it
    // smaller once the keyboard is up, a frame after the window has stopped changing. Without
    // this the mascot stayed at its old size, over the title.
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(soon);
    let watched: Element | null = null;
    const watch = () => {
      const spot = [...document.querySelectorAll(selector)].find((n) => !n.closest('[data-onb-leaving]')) ?? null;
      if (!ro || spot === watched) return;
      ro.disconnect();
      watched = spot;
      if (spot) ro.observe(spot);
    };
    watchSpot.current = watch;
    watch();
    window.addEventListener('resize', soon);
    document.addEventListener('scroll', soon, { capture: true, passive: true });
    window.visualViewport?.addEventListener('resize', soon);
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      watchSpot.current = () => undefined;
      window.removeEventListener('resize', soon);
      document.removeEventListener('scroll', soon, { capture: true });
      window.visualViewport?.removeEventListener('resize', soon);
    };
  }, [move, selector]);

  const spec: MascotExpressionSpec = forced ?? MASCOT_EXPRESSIONS[flashed ?? base];
  const look = gaze ?? spec.look ?? null;
  return (
    <DirectorContext.Provider value={director}>
      {children}
      <div
        ref={el}
        aria-hidden="true"
        data-onb-mascot=""
        className="fixed top-0 left-0 z-50 origin-top-left transition-opacity duration-150"
        style={{ width: MASCOT_BASE, height: MASCOT_BASE, transform: 'translate(-400px, -400px)' }}
        onClick={() => {
          // A tap: a small hop and a blink.
          if (Date.now() - lastPoke.current < POKE_EVERY_MS) return;
          lastPoke.current = Date.now();
          setPoke((n) => n + 1);
        }}
      >
        <Mascot state={spec.state} variant={spec.variant ?? ONBOARDING_VARIANT} boldHappy look={look} size={MASCOT_BASE} poke={poke} celebrate={party} effects={false} />
      </div>
    </DirectorContext.Provider>
  );
}
