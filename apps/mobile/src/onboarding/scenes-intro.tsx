// The three intro scenes (M8c.2), drawn on the scene canvas around the
// mascot, which stands at the same place in all three (MASCOT_AT) so it
// never moves while the pager slides. Each scene plays once, the first time
// its page is shown (`play`); coming back, or under reduced motion, it
// simply stands in its final arrangement. Pieces rest straight: nothing is
// tilted once it has settled, and nothing connects them with lines.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { OnboardingWords } from '@sulo/core/i18n/mobile-onboarding';
import { CheckIcon } from '@sulo/ui/icons';
import { Card } from '@sulo/ui/mobile/cards';
import { ProgressRing } from '@sulo/ui/mobile/ring';
import { TaskCardView } from '@sulo/ui/mobile/task-card';
import { courseTint } from '@sulo/ui/mobile/tint';
import { act, NotifyBanner, schedule, useCountUp } from './bits';
import { useMascot } from './FlyingMascot';
import { EASE_IN, EASE_OUT, EASE_SPRING } from './motion';
import { At } from './Scene';

// The canvas is exactly the content plus 8 px above and below, so the free
// height splits evenly above and below the scene.
export const INTRO_H = 452;
export const INTRO_COMPACT_H = 368;
export const MASCOT_SIZE = 168;
/** Where the mascot stands on the intro canvas (bottom center). */
/** The gap between the last piece above and the mascot: they read as one scene. */
export const MASCOT_GAP = 24;
export const mascotAt = (compact: boolean, width: number) => ({ x: (width - MASCOT_SIZE) / 2, y: compact ? 192 : 276 });

export interface SceneProps {
  w: OnboardingWords;
  compact: boolean;
  /** The canvas width (the stage's): full-width pieces span it. */
  width: number;
  play: boolean;
}

/** A layer of a page: moves a little faster or slower than the page while the pager slides (`depth` px per page; the pager places it). */
export function Layer({ depth = 0, children }: { depth?: number; children: ReactNode }) {
  return (
    <div data-pg="layer" data-depth={depth} className="absolute inset-0">
      {children}
    </div>
  );
}

const TONE: Record<string, string> = { overdue: 'text-urgency-overdue', soon: 'text-urgency-soon', later: 'text-muted-foreground' };
const COLORS = [1, 4, 6, 3];
/** A dense task card with a one-line title, and the stack's pitch. */
const CARD_H = 76;
const PITCH = 84;
const T = (x: number, y: number, r = 0) => `translate(${x}px, ${y}px) rotate(${r}deg)`;
/** Where each card comes from, and how it lies before the stack tidies itself. */
const FROM = [T(-340, 0, -14), T(360, PITCH, 12), T(-12, PITCH + 220, -8)];
const MESSY = [T(-14, 8, -6), T(18, PITCH + 4, 5), T(-8, PITCH + 10, -3)];

/** Screen 1: real task cards arrive untidy from three sides, straighten into a stack, the top one is ticked and leaves, the next ones move up. */
export function SceneTasks({ w, compact, width, play }: SceneProps) {
  const mascot = useMascot();
  // The stack ends 24 px above the mascot; each card is CARD_H tall.
  const base = mascotAt(compact, width).y - MASCOT_GAP - CARD_H;
  const slots = (compact ? [1, 0] : [2, 1, 0]).map((k) => base - k * PITCH);
  const n = slots.length;
  const cards = w.intro1.cards.slice(0, n + 1);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!play) return;
    setDone(false);
    const total = 2700;
    const el = (i: number) => refs.current[i] ?? null;
    const anims: (Animation | null)[] = [];
    // The top card: in, tidy, ticked, out to the right.
    anims.push(
      act(el(0), total, [
        { at: 0, opacity: 0, transform: FROM[0]!, easing: EASE_OUT },
        { at: 420, opacity: 1, transform: MESSY[0]! },
        { at: 760, opacity: 1, transform: MESSY[0]!, easing: EASE_OUT },
        { at: 1120, opacity: 1, transform: T(0, 0) },
        { at: 1820, opacity: 1, transform: T(0, 0), easing: EASE_IN },
        { at: 2040, opacity: 0, transform: T(340, 0) },
        { at: total, opacity: 0, transform: T(340, 0) },
      ]),
    );
    // The cards under it: in one slot lower, tidy, then up one slot.
    for (let k = 1; k < n; k++) {
      const d = 90 * k;
      anims.push(
        act(el(k), total, [
          { at: 0, opacity: 0, transform: FROM[k]! },
          { at: d, opacity: 0, transform: FROM[k]!, easing: EASE_OUT },
          { at: d + 420, opacity: 1, transform: MESSY[k]! },
          { at: 760 + k * 40, opacity: 1, transform: MESSY[k]!, easing: EASE_OUT },
          { at: 1120 + k * 40, opacity: 1, transform: T(0, PITCH) },
          { at: 1900 + k * 60, opacity: 1, transform: T(0, PITCH), easing: EASE_OUT },
          { at: 2260 + k * 60, opacity: 1, transform: T(0, 0) },
          { at: total, opacity: 1, transform: T(0, 0) },
        ]),
      );
    }
    // The next task rises into the free slot.
    anims.push(
      act(el(n), total, [
        { at: 0, opacity: 0, transform: T(0, 56) },
        { at: 2140, opacity: 0, transform: T(0, 56), easing: EASE_OUT },
        { at: 2500, opacity: 1, transform: T(0, 0) },
        { at: total, opacity: 1, transform: T(0, 0) },
      ]),
    );
    const stop = schedule([
      [80, () => mascot.lookAt(el(0), 500)],
      [300, () => mascot.lookAt(el(1), 500)],
      [760, () => mascot.lookAt(el(0), 900)],
      [1400, () => setDone(true)],
      [1480, () => mascot.flash('happy', 900)],
      [1840, () => mascot.lookAt({ x: window.innerWidth, y: el(0)?.getBoundingClientRect().top ?? 0 }, 500)],
    ]);
    return () => {
      stop();
      anims.forEach((a) => a?.cancel());
    };
    // Plays once per showing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  return (
    <Layer>
      {cards.map((c, k) => (
        // Card 0 has left by the end; the others rest one slot up.
        <At key={c.title} x={0} y={slots[Math.max(0, k - 1)]!} w={width} h={CARD_H} z={n + 1 - k} pieceRef={(node) => void (refs.current[k] = node)} className={k === 0 ? 'opacity-0' : ''}>
          <TaskCardView course={c.course} color={courseTint(COLORS[k])} title={c.title} relative={c.due} tone={k === 0 && done ? 'text-muted-foreground' : (TONE[c.tone] ?? '')} done={k === 0 && done} doneLabel={c.title} onDone={() => undefined} />
        </At>
      ))}
    </Layer>
  );
}

/** Screen 2: a real-size reminder drops in and settles, its bell rings; a countdown that really ticks and the attendance ring sit side by side over the mascot. */
export function SceneRemind({ w, compact, width, play }: SceneProps) {
  const t = w.intro2;
  const mascot = useMascot();
  const banner = useRef<HTMLDivElement | null>(null);
  const bell = useRef<HTMLSpanElement | null>(null);
  const left = useRef<HTMLDivElement | null>(null);
  const right = useRef<HTMLDivElement | null>(null);
  const ring = useCountUp(90, 700, play, 700);
  // The countdown is real: it loses a second every second while the screen shows.
  const [secs, setSecs] = useState(3 * 3600 + 59 * 60 + 58);
  useEffect(() => {
    const id = window.setInterval(() => setSecs((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!play) return;
    const anims = [
      act(banner.current, 620, [
        { at: 0, opacity: 0, transform: T(0, -180), easing: EASE_IN },
        { at: 300, opacity: 1, transform: T(0, 8), easing: EASE_OUT },
        { at: 440, opacity: 1, transform: T(0, -5), easing: 'ease-in-out' },
        { at: 620, opacity: 1, transform: T(0, 0) },
      ]),
      act(bell.current, 1300, [
        { at: 0, transform: 'rotate(0deg)' },
        { at: 320, transform: 'rotate(0deg)', easing: 'ease-in-out' },
        { at: 460, transform: 'rotate(16deg)', easing: 'ease-in-out' },
        { at: 640, transform: 'rotate(-13deg)', easing: 'ease-in-out' },
        { at: 820, transform: 'rotate(9deg)', easing: 'ease-in-out' },
        { at: 1000, transform: 'rotate(-5deg)', easing: 'ease-in-out' },
        { at: 1300, transform: 'rotate(0deg)' },
      ]),
      act(left.current, 800, [
        { at: 0, opacity: 0, transform: T(-28, 0) },
        { at: 440, opacity: 0, transform: T(-28, 0), easing: EASE_OUT },
        { at: 800, opacity: 1, transform: T(0, 0) },
      ]),
      act(right.current, 880, [
        { at: 0, opacity: 0, transform: T(28, 0) },
        { at: 520, opacity: 0, transform: T(28, 0), easing: EASE_OUT },
        { at: 880, opacity: 1, transform: T(0, 0) },
      ]),
    ];
    const stop = schedule([
      [0, () => mascot.lookAt(banner.current, 700)],
      [320, () => mascot.hop()],
      [520, () => mascot.express('happy')],
    ]);
    return () => {
      stop();
      anims.forEach((a) => a?.cancel());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  const tileH = compact ? 84 : 148;
  const tileW = (width - 12) / 2;
  // Two tiles 24 px above the mascot, the banner 12 px above them.
  const tileY = mascotAt(compact, width).y - MASCOT_GAP - tileH;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return (
    <>
      <Layer depth={70}>
        <At x={0} y={tileY - 12 - 68} w={width} h={68} pieceRef={banner} z={3}>
          <NotifyBanner title={t.notifyTitle} body={t.notifyCourse} bellRef={bell} />
        </At>
      </Layer>
      <Layer depth={-40}>
        <At x={0} y={tileY} w={tileW} h={tileH} pieceRef={left}>
          <Card dense className="h-full">
            <p className="text-m12 text-muted-foreground">{t.countdownLabel}</p>
            <p className="mt-1 text-m22 whitespace-nowrap text-primary tabular-nums">{t.left(h, m, secs % 60)}</p>
            {!compact && <p className="mt-1 truncate text-m12 text-muted-foreground">{t.notifyTitle}</p>}
          </Card>
        </At>
        <At x={tileW + 12} y={tileY} w={tileW} h={tileH} pieceRef={right}>
          <Card dense className="h-full">
            <p className="text-m12 text-muted-foreground">{t.attendanceLabel}</p>
            <div className="mt-1 flex items-center gap-3">
              <ProgressRing value={ring} size={compact ? 48 : 64} stroke={compact ? 6 : 7} label={`${ring}%`} />
              <span className="text-m22 tabular-nums">{ring}%</span>
            </div>
          </Card>
        </At>
      </Layer>
    </>
  );
}

/** Screen 3: the outline of a phone draws itself around the mascot, small data cards move in and stay, a lock closes on top, three short badges follow. */
export function ScenePrivate({ w, compact, width, play }: SceneProps) {
  const t = w.intro3;
  const mascot = useMascot();
  const H = compact ? INTRO_COMPACT_H : INTRO_H;
  const phone = { x: (width - 216) / 2, y: 28, w: 216, h: H - 32 };
  const outline = useRef<SVGRectElement | null>(null);
  const lock = useRef<HTMLDivElement | null>(null);
  const shackle = useRef<SVGPathElement | null>(null);
  const data = useRef<(HTMLDivElement | null)[]>([]);
  const badges = useRef<(HTMLDivElement | null)[]>([]);
  const rows = compact ? t.data.slice(0, 2) : t.data;
  const dataY = (i: number) => phone.y + 44 + i * 42;
  const zone = dataY(rows.length) + 4;
  const tags = compact ? t.badges.slice(0, 2) : t.badges;

  useEffect(() => {
    if (!play) return;
    const anims: (Animation | null)[] = [];
    anims.push(
      act(outline.current, 760, [
        { at: 0, strokeDashoffset: 1, easing: EASE_OUT },
        { at: 760, strokeDashoffset: 0 },
      ]),
    );
    rows.forEach((_, i) => {
      const d = 480 + i * 130;
      const from = T(i % 2 ? 190 : -190, 0);
      anims.push(
        act(data.current[i] ?? null, d + 360, [
          { at: 0, opacity: 0, transform: from },
          { at: d, opacity: 0, transform: from, easing: EASE_OUT },
          { at: d + 360, opacity: 1, transform: T(0, 0) },
        ]),
      );
    });
    const lockAt = 480 + rows.length * 130 + 240;
    anims.push(
      act(lock.current, lockAt + 320, [
        { at: 0, opacity: 0, transform: 'translateY(-14px) scale(0.92)' },
        { at: lockAt, opacity: 0, transform: 'translateY(-14px) scale(0.92)', easing: EASE_SPRING },
        { at: lockAt + 320, opacity: 1, transform: 'translateY(0) scale(1)' },
      ]),
      act(shackle.current, lockAt + 520, [
        { at: 0, transform: 'translateY(-3.5px)' },
        { at: lockAt + 300, transform: 'translateY(-3.5px)', easing: EASE_OUT },
        { at: lockAt + 520, transform: 'translateY(0)' },
      ]),
    );
    tags.forEach((_, i) => {
      const d = lockAt + 420 + i * 200;
      const from = T(i % 2 ? 20 : -20, 0);
      anims.push(
        act(badges.current[i] ?? null, d + 320, [
          { at: 0, opacity: 0, transform: from },
          { at: d, opacity: 0, transform: from, easing: EASE_OUT },
          { at: d + 320, opacity: 1, transform: T(0, 0) },
        ]),
      );
    });
    const stop = schedule([
      ...rows.map((_, i) => [480 + i * 130, () => mascot.lookAt(data.current[i] ?? null, 400)] as const),
      [lockAt, () => mascot.lookAt(lock.current, 600)],
      [lockAt + 420, () => mascot.express('proud')],
    ]);
    return () => {
      stop();
      anims.forEach((a) => a?.cancel());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  return (
    <>
      <Layer>
        {/* The phone: a solid line, drawn once. */}
        <At x={phone.x} y={phone.y} w={phone.w} h={phone.h}>
          <svg aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible" fill="none">
            <rect ref={outline} x="1" y="1" width={phone.w - 2} height={phone.h - 2} rx="34" stroke="var(--text)" strokeWidth="2" pathLength={1} strokeDasharray="1" strokeDashoffset="0" opacity="0.9" />
          </svg>
        </At>
        <At x={width / 2 - 22} y={phone.y - 20} w={44} h={44} pieceRef={lock} z={3}>
          <span className="flex size-11 items-center justify-center rounded-full bg-foreground text-bg">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path ref={shackle} d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </span>
        </At>
      </Layer>
      <Layer depth={-36}>
        {rows.map((label, i) => (
          <At key={label} x={phone.x + 28} y={dataY(i)} w={phone.w - 56} h={34} pieceRef={(n) => void (data.current[i] = n)}>
            <span className="m-card flex h-full items-center gap-2 rounded-ctl px-3 text-m13">
              <span aria-hidden="true" className="size-2 rounded-full" style={{ background: `var(--course-${[1, 4, 6][i]})` }} />
              {label}
            </span>
          </At>
        ))}
      </Layer>
      <Layer depth={64}>
        {tags.map((label, i) => (
          <At key={label} x={i % 2 ? width - 150 - (width - 328) / 2 : (width - 328) / 2} y={zone + i * (compact ? 34 : 32)} w={150} h={30} pieceRef={(n) => void (badges.current[i] = n)} z={2} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}>
            <span className="inline-flex h-[30px] items-center gap-1.5 rounded-full bg-m-inset px-3 text-m12 font-medium whitespace-nowrap">
              <CheckIcon aria-hidden="true" className="size-3.5" />
              {label}
            </span>
          </At>
        ))}
      </Layer>
    </>
  );
}

