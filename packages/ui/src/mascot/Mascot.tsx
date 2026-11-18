import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { MascotState } from '@sulo/core/view/popup-view';
import { BASE, EYE_CENTERS, GLANCE, MASCOT_CENTER, spiralPath, STAR_CENTERS, STAR_PATH, Z_PATH } from './geometry';
import { playJump, playSquash } from './jump';
import { burstStars, floatZ, riseEmber } from './particles';
import { MASCOT_SHAPES, type EyesKey } from './shapes.generated';
import './mascot.css';

// The Sulo mascot: SVG + CSS, with a little Web Animations API for particles
// and jumps. One component for the popup and onboarding.
//
// Nested layers, each with exactly one animation source, all pivoting on the
// base point (BASE) in view-box units so no pivot can drift:
//   m-root    Web Animations only: jumps and state-change squash
//   m-pose    CSS: state pose (urgent shiver, dizzy wobble)
//   m-breath  CSS: breathing
//   m-size    CSS transition: state scale and opacity
//   m-flame   CSS: flame sway (both layers as one group)
//   m-follow  CSS: face and eyes, a beat behind the flame
//
// - Flame colors are CSS variables on the gradient stops, so each state can
//   warm up, dim or turn crimson with a transition.
// - The flame sways as one group from its base; the face follows a beat late.
// - Eyes blink, glance around, or follow the cursor (onboarding only).
// - Celebrate: one timeline from the moment it starts: two jumps (the second
//   lower) during 2.75 s of star eyes, then 2 s of happy eyes, then back.
// - Everything stops while the page is hidden and under reduced motion.

type Shown = MascotState | 'happy-after';

const EYES_FOR: Record<Shown, EyesKey> = {
  idle: 'open',
  syncing: 'open',
  onboarding: 'open',
  'all-done': 'happy',
  celebrate: 'star',
  'happy-after': 'happy',
  urgent: 'wide',
  sleepy: 'sleepy',
  stale: 'sleepy',
  dizzy: 'spiral',
};

const STAR_MS = 2750;
const HAPPY_AFTER_MS = 2000;
/** Jump heights in mascot units (the frame is 600 tall). */
const CELEBRATE_JUMPS = [88, 46] as const;
const HOP = [30] as const;
const STAR_COUNT = 10;
const EMBER_COUNT = 5;
const Z_COUNT = 3;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const media = (q: string) => typeof matchMedia === 'function' && matchMedia(q).matches;

/** Splits generated eye markup into one string per eye, so each eye can spin on its own center. */
function eyeParts(key: EyesKey): string[] {
  return MASCOT_SHAPES.eyes[key].match(/<(?:path|rect)\b[^>]*\/>/g) ?? [];
}

function useMotionAllowed(still: boolean): boolean {
  const [reduced, setReduced] = useState(() => media('(prefers-reduced-motion: reduce)'));
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mql = matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return !still && !reduced;
}

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}

export interface MascotProps {
  state: MascotState;
  /** Pixel size or any CSS length (e.g. "clamp(220px, 22vw, 360px)"). */
  size?: number | string;
  /** Increment to play the celebrate sequence on top of `state`. */
  celebrate?: number;
  /** Eyes follow the cursor within 400 px (onboarding and dashboard only). */
  followCursor?: boolean;
  /** Force the static mascot (also implied by prefers-reduced-motion). */
  still?: boolean;
  /** Particles need room; off by default for small sizes. */
  effects?: boolean;
  className?: string;
  /** Accessible label; decorative when omitted. */
  label?: string;
  /** Contact shadow under the mascot; it shrinks and fades as the mascot jumps. */
  grounded?: boolean;
  /** Alert (a deadline within a day): blinks about twice as often. */
  alert?: boolean;
  /** Increment for one short reaction: a small hop and a blink (the Android app's tap). */
  poke?: number;
}

export function Mascot({ state, size = 48, celebrate = 0, followCursor = false, still = false, effects, className, label, grounded = false, alert = false, poke = 0 }: MascotProps) {
  const motion = useMotionAllowed(still);
  const visible = usePageVisible();
  const active = motion && visible;
  const fx = (effects ?? (typeof size === 'number' ? size >= 96 : true)) && active;
  const id = useId().replace(/:/g, '');

  const [shown, setShown] = useState<Shown>(state === 'celebrate' ? 'celebrate' : state);
  const [blink, setBlink] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const rootRef = useRef<SVGGElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const shadowRef = useRef<SVGEllipseElement>(null);
  const starsRef = useRef<(SVGPathElement | null)[]>([]);
  const embersRef = useRef<(SVGCircleElement | null)[]>([]);
  const zsRef = useRef<(SVGPathElement | null)[]>([]);

  // --- State and the celebrate sequence -------------------------------------
  useEffect(() => {
    if (state === 'celebrate') return; // handled as a sequence below
    setShown((s) => (s === 'celebrate' || s === 'happy-after' ? s : state));
  }, [state]);

  useEffect(() => {
    if (celebrate === 0 && state !== 'celebrate') return;
    setShown('celebrate');
    // Everything is timed from this one start; the jump runs on m-root and is
    // never restarted by the eye changes, which only touch other layers.
    const jumps = active && rootRef.current ? playJump(rootRef.current, shadowRef.current, CELEBRATE_JUMPS) : [];
    const t1 = window.setTimeout(() => setShown('happy-after'), STAR_MS);
    const t2 = window.setTimeout(() => setShown(state === 'celebrate' ? 'all-done' : state), STAR_MS + HAPPY_AFTER_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      jumps.forEach((a) => a.finish());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrate]);

  // Squash and stretch on a state change. Not inside the celebrate sequence:
  // the jump already carries that motion and must not be cut off.
  const firstShown = useRef(true);
  useEffect(() => {
    if (firstShown.current) {
      firstShown.current = false;
      return;
    }
    if (!active || !rootRef.current || shown === 'celebrate' || shown === 'happy-after') return;
    playSquash(rootRef.current);
  }, [shown, active]);

  // All done: a small hop now and then, with the same jump motion.
  useEffect(() => {
    if (!active || shown !== 'all-done') return;
    let id = 0;
    const next = () => {
      id = window.setTimeout(() => {
        if (rootRef.current) playJump(rootRef.current, shadowRef.current, HOP);
        next();
      }, rand(5500, 8500));
    };
    next();
    return () => window.clearTimeout(id);
  }, [active, shown]);

  // A poke: one small hop and a blink, then back to the state.
  const firstPoke = useRef(poke);
  useEffect(() => {
    if (poke === firstPoke.current || !active || !rootRef.current) return;
    playJump(rootRef.current, shadowRef.current, HOP);
    setBlink(true);
    const t = window.setTimeout(() => setBlink(false), 130);
    return () => window.clearTimeout(t);
  }, [poke, active]);

  // --- Eyes: target position, smoothed in a rAF loop ------------------------
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const raf = useRef(0);
  const cursorNear = useRef(false);

  const startLoop = () => {
    if (raf.current) return;
    const step = () => {
      const c = current.current;
      const t = target.current;
      c.x += (t.x - c.x) * 0.18;
      c.y += (t.y - c.y) * 0.18;
      const squash = Math.abs(c.y) > GLANCE.y * 0.5 ? 0.9 : 1;
      eyesRef.current?.setAttribute('transform', `translate(${c.x.toFixed(2)} ${c.y.toFixed(2)})`);
      eyesRef.current?.style.setProperty('--squash', String(squash));
      if (Math.abs(t.x - c.x) + Math.abs(t.y - c.y) > 0.2) raf.current = requestAnimationFrame(step);
      else raf.current = 0;
    };
    raf.current = requestAnimationFrame(step);
  };
  const lookAt = (x: number, y: number) => {
    target.current = { x, y };
    startLoop();
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // Random glances (idle, onboarding), a look down at the list (urgent).
  useEffect(() => {
    if (!active) return lookAt(0, 0);
    if (shown === 'urgent') return lookAt(0, GLANCE.y * 0.7);
    if (shown !== 'idle' && shown !== 'onboarding') return lookAt(0, 0);
    let cancelled = false;
    const ids: number[] = [];
    const loop = () => {
      ids.push(
        window.setTimeout(() => {
          if (cancelled) return;
          if (!cursorNear.current) lookAt(rand(-GLANCE.x, GLANCE.x), rand(-GLANCE.y, GLANCE.y));
          ids.push(
            window.setTimeout(() => {
              if (cancelled) return;
              if (!cursorNear.current) lookAt(0, 0);
              loop();
            }, rand(800, 1500)),
          );
        }, rand(4000, 8000)),
      );
    };
    loop();
    return () => {
      cancelled = true;
      ids.forEach((t) => window.clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, shown]);

  // Follow the cursor within 400 px, only where asked and with a fine pointer.
  useEffect(() => {
    if (!followCursor || !active || media('(pointer: coarse)')) return;
    let pending = 0;
    const onMove = (e: PointerEvent) => {
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        const box = svgRef.current?.getBoundingClientRect();
        if (!box) return;
        const dx = e.clientX - (box.left + box.width / 2);
        const dy = e.clientY - (box.top + box.height * 0.75);
        const near = Math.hypot(dx, dy) < 400;
        cursorNear.current = near;
        if (!near) return;
        const clamp = (v: number) => Math.max(-1, Math.min(1, v));
        lookAt(clamp(dx / 260) * GLANCE.x, clamp(dy / 260) * GLANCE.y);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(pending);
      cursorNear.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followCursor, active]);

  // Blinks every 3 to 6 s, sometimes twice.
  useEffect(() => {
    if (!active || !['idle', 'onboarding', 'syncing', 'urgent'].includes(shown)) return;
    let cancelled = false;
    const ids: number[] = [];
    const schedule = () => {
      ids.push(
        window.setTimeout(() => {
          if (cancelled) return;
          setBlink(true);
          ids.push(window.setTimeout(() => setBlink(false), 130));
          if (Math.random() < 0.25) {
            ids.push(window.setTimeout(() => setBlink(true), 260));
            ids.push(window.setTimeout(() => setBlink(false), 390));
          }
          schedule();
        }, alert ? rand(1500, 3000) : rand(3000, 6000)),
      );
    };
    schedule();
    return () => {
      cancelled = true;
      ids.forEach((t) => window.clearTimeout(t));
      setBlink(false);
    };
  }, [active, shown, alert]);

  // --- Particles --------------------------------------------------------------
  useEffect(() => {
    if (!fx || shown !== 'celebrate') return;
    const animations = burstStars(starsRef.current.filter((s): s is SVGPathElement => s !== null));
    return () => animations.forEach((a) => a.cancel());
  }, [fx, shown]);

  useEffect(() => {
    if (!fx || (shown !== 'urgent' && shown !== 'sleepy')) return;
    const pool = shown === 'urgent' ? embersRef.current : zsRef.current;
    const spawn = shown === 'urgent' ? riseEmber : floatZ;
    const every = shown === 'urgent' ? 700 : 1800;
    const running: Animation[] = [];
    let next = 0;
    const tick = () => {
      const el = pool[next % pool.length];
      next += 1;
      if (el) running.push(spawn(el));
      if (running.length > pool.length * 2) running.splice(0, running.length - pool.length * 2);
    };
    tick();
    const t = window.setInterval(tick, every);
    return () => {
      window.clearInterval(t);
      running.forEach((a) => a.cancel());
    };
  }, [fx, shown]);

  // --- Render -----------------------------------------------------------------
  const eyesKey = EYES_FOR[shown];
  const parts = useMemo(() => (eyesKey === 'spiral' ? [] : eyeParts(eyesKey)), [eyesKey]);
  const [g0, g1] = MASCOT_SHAPES.gradients;
  const cssSize = typeof size === 'number' ? `${size}px` : size;
  const style = { width: cssSize, height: cssSize } as CSSProperties;
  const pivot = { transformOrigin: `${BASE.x}px ${BASE.y}px` } as CSSProperties;
  const oval = MASCOT_SHAPES.faceOval;

  const eyes = (
    <g ref={eyesRef}>
      <g className="m-look">
        <g className="m-squash">
          <g className="m-blink">
            {eyesKey === 'spiral'
              ? EYE_CENTERS.map((c, i) => (
                  // Each spiral spins around its own center, at a slightly different speed.
                  <path key={i} className={`m-eye m-spiral m-spiral-${i}`} style={{ transformOrigin: `${c.x}px ${c.y}px` }} d={spiralPath(c.x, c.y)} />
                ))
              : parts.map((markup, i) => (
                  // Safe: generated at build time from our own brand assets, never user content.
                  <g
                    key={`${eyesKey}-${i}`}
                    className={eyesKey === 'star' ? 'm-eye m-eye-pivot' : 'm-eye'}
                    style={eyesKey === 'star' && STAR_CENTERS[i] ? { transformOrigin: `${STAR_CENTERS[i].x}px ${STAR_CENTERS[i].y}px` } : undefined}
                    dangerouslySetInnerHTML={{ __html: markup }}
                  />
                ))}
          </g>
        </g>
      </g>
    </g>
  );

  const classes = [
    'sulo-mascot',
    `is-${shown === 'happy-after' ? 'celebrate-after' : shown}`,
    active ? 'is-animated' : 'is-still',
    blink ? 'is-blinking' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      ref={svgRef}
      viewBox="-40 -60 590 600"
      style={style}
      className={classes}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id={`${id}-g0`} x1={g0.x1} y1={g0.y1} x2={g0.x2} y2={g0.y2} gradientUnits="userSpaceOnUse">
          <stop offset={0} className="st-a" />
          <stop offset={1} className="st-b" />
        </linearGradient>
        <linearGradient id={`${id}-g1`} x1={g1.x1} y1={g1.y1} x2={g1.x2} y2={g1.y2} gradientUnits="userSpaceOnUse">
          <stop offset={0} className="st-a" />
          <stop offset={0.5} className="st-b" />
          <stop offset={1} className="st-c" />
        </linearGradient>
        {/* Eyes are clipped by the face: the oval when animated, face-cut when still. */}
        <clipPath id={`${id}-face`}>
          {active ? <ellipse cx={oval.cx} cy={oval.cy} rx={oval.rx} ry={oval.ry} /> : <path d={MASCOT_SHAPES.face} />}
        </clipPath>
        {/* face-clip: the flame silhouette (flame-back and flame together). It
            is a <mask> rather than a <clipPath>: Chrome's clipPath union drops
            most of flame-back (overlapping subpaths), while a mask is rasterized
            and exact. Static: it is applied inside the flame group, so it
            already moves with the flame. Nothing inside it is animated. */}
        {active && (
          <mask id={`${id}-flame`} maskUnits="userSpaceOnUse" x={-40} y={-60} width={590} height={600}>
            <path d={MASCOT_SHAPES.flame[0]} fill="#fff" />
            <path d={MASCOT_SHAPES.flame[1]} fill="#fff" />
          </mask>
        )}
      </defs>

      {grounded && (
        <ellipse ref={shadowRef} className="m-shadow" style={{ transformOrigin: `${BASE.x}px ${BASE.y + 8}px` }} cx={BASE.x} cy={BASE.y + 8} rx={112} ry={11} />
      )}
      <g ref={rootRef} className="m-root" style={pivot}>
        <g className="m-pose" style={pivot}>
        <g className="m-breath" style={pivot}>
        <g className="m-size" style={pivot}>
          {/* Both flame layers move as one group, so the silhouette never splits.
              The face rides inside the same group and adds only a small
              lagging motion of its own (m-follow), so it never leaves the
              flame. Animated: flame and the full face oval are drawn together
              and masked once by face-clip. The oval reaches past the flame's
              bottom edge, so that edge is drawn by the mask alone: no two
              edges coincide and no flame hairline shows under the face.
              Still (reduced motion): the flat face-cut, no clip. */}
          <g className="m-flame" style={pivot}>
            <g mask={active ? `url(#${id}-flame)` : undefined}>
              <path className="m-flame-back" d={MASCOT_SHAPES.flame[0]} fill={`url(#${id}-g0)`} />
              <path className="m-flame-front" d={MASCOT_SHAPES.flame[1]} fill={`url(#${id}-g1)`} />
              <g className="m-follow" style={pivot}>
                {active ? (
                  <ellipse className="m-face" cx={oval.cx} cy={oval.cy} rx={oval.rx} ry={oval.ry} />
                ) : (
                  <path className="m-face" d={MASCOT_SHAPES.face} />
                )}
                <g clipPath={`url(#${id}-face)`}>{eyes}</g>
              </g>
            </g>
          </g>
        </g>
        </g>
        </g>
      </g>

      {fx && (
        <g className="m-fx" aria-hidden="true">
          {Array.from({ length: STAR_COUNT }, (_, i) => (
            <path key={`s${i}`} ref={(el) => void (starsRef.current[i] = el)} className="m-star" d={STAR_PATH} opacity={0} />
          ))}
          {Array.from({ length: EMBER_COUNT }, (_, i) => (
            <circle key={`e${i}`} ref={(el) => void (embersRef.current[i] = el)} className="m-ember" r={1} opacity={0} />
          ))}
          {Array.from({ length: Z_COUNT }, (_, i) => (
            <path key={`z${i}`} ref={(el) => void (zsRef.current[i] = el)} className="m-z" d={Z_PATH} opacity={0} />
          ))}
          {shown === 'dizzy' && (
            <g className="m-orbit" style={{ transformOrigin: `${MASCOT_CENTER.x}px ${MASCOT_CENTER.y - 60}px` }}>
              {[0, 120, 240].map((deg) => {
                const r = (deg * Math.PI) / 180;
                return (
                  <path
                    key={deg}
                    className="m-orbit-star"
                    d={STAR_PATH}
                    transform={`translate(${MASCOT_CENTER.x + Math.cos(r) * 230} ${MASCOT_CENTER.y - 60 + Math.sin(r) * 70}) scale(16)`}
                  />
                );
              })}
            </g>
          )}
        </g>
      )}
    </svg>
  );
}
