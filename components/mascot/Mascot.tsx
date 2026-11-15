import { useEffect, useId, useRef, useState } from 'react';
import type { MascotState } from '@/lib/view/popup-view';
import { MASCOT_SHAPES, type EyesKey } from './shapes.generated';
import './mascot.css';

// Animated mascot with SVG + CSS only (no runtime). Behaviour follows the
// brand spec: random blinks (vertical scale, sometimes twice), random glances
// when idle (about 15% of the face width sideways, 10% of its height up or
// down, with a slight squash), a short "celebrate" that returns to all-done,
// and no motion at all under prefers-reduced-motion.

const EYES_FOR: Record<MascotState, EyesKey> = {
  idle: 'open',
  syncing: 'open',
  onboarding: 'open',
  'all-done': 'happy',
  celebrate: 'star',
  urgent: 'wide',
  sleepy: 'sleepy',
  dizzy: 'dizzy',
};

// Face bounds in SVG units (face-cut spans x 75.7..413.7, y 290..512).
const GLANCE_X = 0.15 * 338;
const GLANCE_Y = 0.1 * 222;
const CELEBRATE_MS = 1500;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mql = matchMedia(query);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export interface MascotProps {
  state: MascotState;
  size?: number;
  /** Force the static mascot (also implied by prefers-reduced-motion). */
  still?: boolean;
  className?: string;
  /** Accessible label; decorative when omitted. */
  label?: string;
}

export function Mascot({ state, size = 48, still = false, className, label }: MascotProps) {
  const reduced = usePrefersReducedMotion();
  const animated = !still && !reduced;
  const id = useId().replace(/:/g, '');
  const [shown, setShown] = useState<MascotState>(state);
  const [blink, setBlink] = useState(false);
  const [glance, setGlance] = useState({ x: 0, y: 0 });
  const timers = useRef<number[]>([]);

  // Celebrate is brief: it settles into all-done.
  useEffect(() => {
    setShown(state);
    if (state !== 'celebrate') return;
    const t = window.setTimeout(() => setShown('all-done'), CELEBRATE_MS);
    return () => window.clearTimeout(t);
  }, [state]);

  // Blinks every 3 to 6 seconds, sometimes twice.
  useEffect(() => {
    if (!animated || shown === 'dizzy' || shown === 'all-done' || shown === 'celebrate') return;
    let cancelled = false;
    const schedule = () => {
      const t = window.setTimeout(() => {
        if (cancelled) return;
        const double = Math.random() < 0.25;
        setBlink(true);
        timers.current.push(window.setTimeout(() => setBlink(false), 130));
        if (double) {
          timers.current.push(window.setTimeout(() => setBlink(true), 260));
          timers.current.push(window.setTimeout(() => setBlink(false), 390));
        }
        schedule();
      }, rand(3000, 6000));
      timers.current.push(t);
    };
    schedule();
    return () => {
      cancelled = true;
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
  }, [animated, shown]);

  // Random glances when idle; urgent looks towards the task list (down).
  useEffect(() => {
    if (!animated) return setGlance({ x: 0, y: 0 });
    if (shown === 'urgent') return setGlance({ x: 0, y: GLANCE_Y * 0.7 });
    if (shown !== 'idle' && shown !== 'onboarding') return setGlance({ x: 0, y: 0 });
    let cancelled = false;
    const ids: number[] = [];
    const loop = () => {
      ids.push(
        window.setTimeout(() => {
          if (cancelled) return;
          setGlance({ x: rand(-GLANCE_X, GLANCE_X), y: rand(-GLANCE_Y, GLANCE_Y) });
          ids.push(
            window.setTimeout(() => {
              if (cancelled) return;
              setGlance({ x: 0, y: 0 });
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
  }, [animated, shown]);

  const squash = Math.abs(glance.y) > GLANCE_Y * 0.5 ? 0.9 : 1;
  const eyesMarkup = MASCOT_SHAPES.eyes[EYES_FOR[shown]];
  const [g0, g1] = MASCOT_SHAPES.gradients;

  return (
    <svg
      viewBox={MASCOT_SHAPES.viewBox}
      width={size}
      height={size}
      className={['sulo-mascot', `is-${shown}`, animated ? 'is-animated' : 'is-still', className].filter(Boolean).join(' ')}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        {[g0, g1].map((g, i) => (
          <linearGradient key={i} id={`${id}-g${i}`} x1={g?.x1} y1={g?.y1} x2={g?.x2} y2={g?.y2} gradientUnits="userSpaceOnUse">
            {g?.stops.map((s, j) => <stop key={j} offset={s.offset} stopColor={s.color} />)}
          </linearGradient>
        ))}
        <clipPath id={`${id}-face`}>
          <path d={MASCOT_SHAPES.face} />
        </clipPath>
      </defs>
      <g className="m-flame">
        <path d={MASCOT_SHAPES.flame[0]} fill={`url(#${id}-g0)`} />
        <path d={MASCOT_SHAPES.flame[1]} fill={`url(#${id}-g1)`} />
        <path d={MASCOT_SHAPES.face} className="m-face" />
        <g clipPath={`url(#${id}-face)`}>
          <g className="m-eyes" style={{ transform: `translate(${glance.x}px, ${glance.y}px) scale(1, ${squash})` }}>
            {/* Safe: eyesMarkup is a build-time constant generated from our own brand
                assets (scripts/build-mascot.mjs), never user or SIKOLA content. */}
            <g className={blink ? 'm-blink is-blinking' : 'm-blink'} dangerouslySetInnerHTML={{ __html: eyesMarkup }} />
          </g>
        </g>
      </g>
    </svg>
  );
}
