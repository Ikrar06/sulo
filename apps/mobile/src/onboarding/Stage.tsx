// The intro stage (M8c.2): real packages/ui cards with synthetic data,
// stacked and slightly tilted (-4 to 4 degrees, scale 0.82-0.92), joined by
// a thin dashed line that draws itself. The stage background is the screen's
// own (no gradient). Each piece enters once; under reduced motion everything
// sits at its resting place.

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Card, Chip } from '@sulo/ui/mobile/cards';
import { CheckCircle } from '@sulo/ui/mobile/controls';
import { courseTint } from '@sulo/ui/mobile/tint';
import { draw, enter, reducedMotion, type EnterFrom } from './motion';

export interface Rest {
  /** Position of the card's top-left corner in % of the stage. */
  left: number;
  top: number;
  width: number;
  rotate: number;
  scale: number;
}

/** One collage piece: placed at rest, entering from `from` after `delay`. */
export function Piece({ rest, from, delay, duration, easing, z = 0, children, onIn }: { rest: Rest; from: EnterFrom; delay: number; duration?: number; easing?: string; z?: number; children: ReactNode; onIn?: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const done = useRef(onIn);
  done.current = onIn;
  useEffect(() => {
    const a = enter(ref.current, from, { delay, duration, easing, rest: { rotate: rest.rotate, scale: rest.scale } });
    if (!a) return void done.current?.();
    a.onfinish = () => done.current?.();
    return () => a.cancel();
    // Enters once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style: CSSProperties = { left: `${rest.left}%`, top: `${rest.top}%`, width: `${rest.width}%`, zIndex: z, transform: `rotate(${rest.rotate}deg) scale(${rest.scale})`, transformOrigin: 'center' };
  return (
    <div ref={ref} className="absolute" style={style}>
      {children}
    </div>
  );
}

/** A dashed line through points given in % of the stage, drawn from the first point. */
export function Connector({ points, delay }: { points: readonly [number, number][]; delay: number }) {
  const id = useId().replace(/:/g, '');
  const mask = useRef<SVGPathElement | null>(null);
  const d = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
  useEffect(() => {
    const a = draw(mask.current, { delay, duration: 520 });
    return () => a?.cancel();
  }, [delay]);
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <mask id={`m${id}`} maskUnits="userSpaceOnUse">
          <path ref={mask} d={d} fill="none" stroke="#fff" strokeWidth="6" />
        </mask>
      </defs>
      <path d={d} fill="none" stroke="var(--m-line)" strokeWidth="1.5" strokeDasharray="4 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" mask={`url(#m${id})`} />
    </svg>
  );
}

const TONE: Record<string, string> = { overdue: 'text-urgency-overdue', soon: 'text-urgency-soon', later: 'text-muted-foreground' };

/** A task card as Tugas shows it (Card, Chip, CheckCircle), not interactive. */
export function DemoTask({ course, color, title, due, tone, done = false }: { course: string; color: number; title: string; due: string; tone: string; done?: boolean }) {
  return (
    <Card dense>
      <div className="flex items-center gap-2">
        <span className="min-w-0 shrink">
          <Chip small color={courseTint(color)}>
            {course}
          </Chip>
        </span>
        <span className={`ml-auto shrink-0 text-m12 whitespace-nowrap tabular-nums ${done ? 'text-muted-foreground' : (TONE[tone] ?? '')}`}>{due}</span>
      </div>
      <div className="mt-1 flex items-center gap-3">
        <p className={`min-w-0 flex-1 truncate text-m15 transition-colors duration-200 ${done ? 'text-muted-foreground line-through' : ''}`}>{title}</p>
        <span className="-my-1 flex">
          <CheckCircle checked={done} onChange={() => undefined} label={title} />
        </span>
      </div>
    </Card>
  );
}

/** Counts from 0 to `to` in `ms` (no counting under reduced motion). */
export function useCountUp(to: number, ms: number, delay: number): number {
  const [n, setN] = useState(() => (reducedMotion() ? to : 0));
  useEffect(() => {
    if (reducedMotion()) return setN(to);
    let raf = 0;
    const t = window.setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / ms);
        // Ease-out so the last numbers settle.
        setN(Math.round(to * (1 - (1 - p) ** 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [to, ms, delay]);
  return n;
}

/**
 * Fires `fn` once after `ms`. A step of an animation runs at once under
 * reduced motion; `pace` keeps real time (a screen's own 1.6 or 2 seconds).
 */
export function useAfter(ms: number, fn: () => void, pace = false): void {
  const f = useRef(fn);
  f.current = fn;
  useEffect(() => {
    const t = window.setTimeout(() => f.current(), reducedMotion() && !pace ? 0 : ms);
    return () => window.clearTimeout(t);
  }, [ms, pace]);
}
