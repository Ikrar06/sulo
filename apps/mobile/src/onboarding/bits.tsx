// Small parts the onboarding scenes share (M8c.2): the notification banner
// at its real size, a result chip, the spark burst, and timing hooks.

import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { BellIcon } from '@sulo/ui/icons';
import { Card, IconTile } from '@sulo/ui/mobile/cards';
import { reducedMotion, sceneTempo } from './motion';

/** A reminder as the phone shows it: the bell tile, the task, when and where. `bellRef` lets a scene ring the bell. */
export function NotifyBanner({ title, body, bellRef, wrap = false }: { title: string; body: ReactNode; bellRef?: Ref<HTMLSpanElement>; /** With the user's own task: long names wrap instead of being cut. */ wrap?: boolean }) {
  return (
    <Card dense>
      <div className="flex items-center gap-3">
        <span ref={bellRef} className="inline-flex origin-top">
          <IconTile color="accent" icon={BellIcon} size={40} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`${wrap ? 'line-clamp-2 break-words' : 'truncate'} text-m15 font-medium`}>{title}</p>
          <p className={`${wrap ? 'break-words' : 'truncate'} text-m13 text-muted-foreground tabular-nums`}>{body}</p>
        </div>
      </div>
    </Card>
  );
}

/** A small solid chip for a result ("34 tugas"): the number in the text color, the rest muted. */
export function ResultChip({ children, chipRef }: { children: ReactNode; chipRef?: Ref<HTMLSpanElement> }) {
  return (
    <span ref={chipRef} className="m-card inline-flex h-10 items-center rounded-full px-4 text-m15 font-medium whitespace-nowrap tabular-nums">
      {children}
    </span>
  );
}

const SPARK_COLORS = ['var(--brand-amber)', 'var(--brand-orange)', 'var(--brand-crimson)'];
export const SPARK_MAX = 12;

/**
 * One burst of small solid shapes in the mascot's colors from the middle of
 * `host`, at most twelve, once. Nothing under reduced motion.
 */
export function burstSparks(host: HTMLElement | null, count = 10): void {
  if (!host || reducedMotion() || typeof host.animate !== 'function') return;
  const n = Math.min(SPARK_MAX, count);
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    const size = 5 + (i % 3) * 2;
    const angle = (i / n) * Math.PI * 2 + (i % 2) * 0.3;
    const far = 70 + (i % 4) * 16;
    s.setAttribute('aria-hidden', 'true');
    s.style.cssText = `position:absolute;left:50%;top:50%;width:${size}px;height:${size}px;margin:${-size / 2}px;border-radius:${i % 2 ? '50%' : '2px'};background:${SPARK_COLORS[i % 3]};pointer-events:none;`;
    host.appendChild(s);
    const x = Math.cos(angle) * far;
    const y = Math.sin(angle) * far - 20;
    s.animate(
      [
        { transform: 'translate(0, 0) scale(0.92)', opacity: 1 },
        { transform: `translate(${x * 0.8}px, ${y * 0.8}px) scale(1) rotate(${90 + i * 20}deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${x}px, ${y + 14}px) scale(0.92) rotate(${160 + i * 20}deg)`, opacity: 0 },
      ],
      { duration: 620 + (i % 3) * 60, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' },
    ).onfinish = () => s.remove();
  }
}

/** Counts from 0 to `to` in `ms` once `run` is true (the final number at once under reduced motion or when not running). */
export function useCountUp(to: number, baseMs: number, run = true, baseDelay = 0): number {
  // Story motion: at the scenes' tempo.
  const ms = baseMs * sceneTempo();
  const delay = baseDelay * sceneTempo();
  const [n, setN] = useState(() => (run && !reducedMotion() ? 0 : to));
  useEffect(() => {
    if (!run || reducedMotion()) return setN(to);
    let raf = 0;
    setN(0);
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
  }, [to, ms, run, delay]);
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

/**
 * A scene's steps on one clock: each [ms, fn] at the scenes' tempo (story
 * motion); `story: false` keeps real ms (a response). All cancelled together.
 */
export function schedule(steps: readonly (readonly [number, () => void])[], story = true, lead = 0): () => void {
  const k = story ? sceneTempo() : 1;
  const ids = steps.map(([ms, fn]) => window.setTimeout(fn, lead + ms * k));
  return () => ids.forEach((id) => window.clearTimeout(id));
}

/**
 * One element's whole part in a scene: keyframes with `at` in ms on a clock
 * of `total` ms, at the scenes' tempo unless `story` is false. The end is
 * its resting style.
 */
export function act(el: Element | null, total: number, frames: readonly ({ at: number; easing?: string } & Record<string, string | number>)[], story = true, lead = 0): Animation | null {
  if (!el || reducedMotion() || typeof (el as HTMLElement).animate !== 'function') return null;
  const keyframes = frames.map(({ at, ...rest }) => ({ ...rest, offset: Math.min(1, at / total) }));
  // `lead` (real ms): the piece waits at its first pose while its page is still arriving.
  return (el as HTMLElement).animate(keyframes as Keyframe[], { duration: total * (story ? sceneTempo() : 1), delay: lead, fill: 'backwards' });
}
