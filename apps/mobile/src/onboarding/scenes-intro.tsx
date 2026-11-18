// The three intro scenes (M8c.2), drawn on the scene canvas around the
// mascot, which stands at the same place in all three (MASCOT_AT) so it
// never moves while the pager slides. Each scene plays once, the first time
// its page is shown (`play`); coming back, or under reduced motion, it
// simply stands in its final arrangement. Pieces rest straight: nothing is
// tilted once it has settled, and nothing connects them with lines.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { formatCountdown } from '@sulo/core/format/countdown';
import type { OnboardingWords } from '@sulo/core/i18n/mobile-onboarding';
import { CheckIcon } from '@sulo/ui/icons';
import { Card } from '@sulo/ui/mobile/cards';
import { ProgressRing } from '@sulo/ui/mobile/ring';
import { TaskCardView } from '@sulo/ui/mobile/task-card';
import { courseTint } from '@sulo/ui/mobile/tint';
import { act, NotifyBanner, schedule, useCountUp } from './bits';
import { useMascot } from './FlyingMascot';
import { EASE_IN, EASE_OUT, EASE_SPRING, EASE_STORY } from './motion';
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
  /** Real ms the scene waits before it starts: the page (or the step) is still sliding in, and the two never compete. */
  lead: number;
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
export function SceneTasks({ w, compact, width, play, lead }: SceneProps) {
  const mascot = useMascot();
  // The stack ends 24 px above the mascot; each card is CARD_H tall.
  const base = mascotAt(compact, width).y - MASCOT_GAP - CARD_H;
  const slots = (compact ? [1, 0] : [2, 1, 0]).map((k) => base - k * PITCH);
  const n = slots.length;
  const cards = w.intro1.cards.slice(0, n + 1);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const [done, setDone] = useState(false);

  // Before the first paint: the pieces are at their starting places in the very first frame.
  useLayoutEffect(() => {
    if (!play) return;
    setDone(false);
    // Base times (ms) before SCENE_TEMPO. Acts, with a breath between them:
    // arrive untidy, hold, tidy (to 1140), rest 250, tick (1390), rest 180
    // after the tick lands, the top card leaves (1720), the others move up,
    // the next task rises. About 3.4 s at tempo 1.4.
    const total = 2450;
    const el = (i: number) => refs.current[i] ?? null;
    const anims: (Animation | null)[] = [];
    anims.push(
      act(el(0), total, [
        { at: 0, opacity: 0, transform: FROM[0]!, easing: EASE_STORY },
        { at: 420, opacity: 1, transform: MESSY[0]! },
        { at: 700, opacity: 1, transform: MESSY[0]!, easing: EASE_STORY },
        { at: 1060, opacity: 1, transform: T(0, 0) },
        { at: 1720, opacity: 1, transform: T(0, 0), easing: EASE_IN },
        { at: 1940, opacity: 0, transform: T(340, 0) },
        { at: total, opacity: 0, transform: T(340, 0) },
      ], true, lead),
    );
    for (let k = 1; k < n; k++) {
      const d = 100 * k;
      anims.push(
        act(el(k), total, [
          { at: 0, opacity: 0, transform: FROM[k]! },
          { at: d, opacity: 0, transform: FROM[k]!, easing: EASE_STORY },
          { at: d + 420, opacity: 1, transform: MESSY[k]! },
          { at: 700 + k * 40, opacity: 1, transform: MESSY[k]!, easing: EASE_STORY },
          { at: 1060 + k * 40, opacity: 1, transform: T(0, PITCH) },
          { at: 1800 + k * 50, opacity: 1, transform: T(0, PITCH), easing: EASE_STORY },
          { at: 2160 + k * 50, opacity: 1, transform: T(0, 0) },
          { at: total, opacity: 1, transform: T(0, 0) },
        ], true, lead),
      );
    }
    anims.push(
      act(el(n), total, [
        { at: 0, opacity: 0, transform: T(0, 56) },
        { at: 2040, opacity: 0, transform: T(0, 56), easing: EASE_STORY },
        { at: 2400, opacity: 1, transform: T(0, 0) },
        { at: total, opacity: 1, transform: T(0, 0) },
      ], true, lead),
    );
    const stop = schedule([
      [80, () => mascot.lookAt(el(0), 500)],
      [300, () => mascot.lookAt(el(1), 500)],
      [700, () => mascot.lookAt(el(0), 1200)],
      [1390, () => setDone(true)],
      [1470, () => mascot.flash('happy', 1200)],
      [1740, () => mascot.lookAt({ x: window.innerWidth, y: el(0)?.getBoundingClientRect().top ?? 0 }, 500)],
    ], true, lead);
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
export function SceneRemind({ w, compact, width, play, lead }: SceneProps) {
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

  // Before the first paint: the pieces are at their starting places in the very first frame.
  useLayoutEffect(() => {
    if (!play) return;
    const anims = [
      act(banner.current, 620, [
        { at: 0, opacity: 0, transform: T(0, -180), easing: EASE_IN },
        { at: 300, opacity: 1, transform: T(0, 8), easing: EASE_OUT },
        { at: 440, opacity: 1, transform: T(0, -5), easing: 'ease-in-out' },
        { at: 620, opacity: 1, transform: T(0, 0) },
      ], true, lead),
      act(bell.current, 1300, [
        { at: 0, transform: 'rotate(0deg)' },
        { at: 320, transform: 'rotate(0deg)', easing: 'ease-in-out' },
        { at: 460, transform: 'rotate(16deg)', easing: 'ease-in-out' },
        { at: 640, transform: 'rotate(-13deg)', easing: 'ease-in-out' },
        { at: 820, transform: 'rotate(9deg)', easing: 'ease-in-out' },
        { at: 1000, transform: 'rotate(-5deg)', easing: 'ease-in-out' },
        { at: 1300, transform: 'rotate(0deg)' },
      ], true, lead),
      act(left.current, 800, [
        { at: 0, opacity: 0, transform: T(-28, 0) },
        { at: 440, opacity: 0, transform: T(-28, 0), easing: EASE_STORY },
        { at: 800, opacity: 1, transform: T(0, 0) },
      ], true, lead),
      act(right.current, 900, [
        { at: 0, opacity: 0, transform: T(28, 0) },
        { at: 540, opacity: 0, transform: T(28, 0), easing: EASE_STORY },
        { at: 900, opacity: 1, transform: T(0, 0) },
      ], true, lead),
    ];
    const stop = schedule([
      [0, () => mascot.lookAt(banner.current, 700)],
      [320, () => mascot.hop()],
      [520, () => mascot.express('happy')],
    ], true, lead);
    return () => {
      stop();
      anims.forEach((a) => a?.cancel());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  const tileH = compact ? 84 : 136;
  const tileW = (width - 12) / 2;
  // Two tiles 24 px above the mascot, the banner 12 px above them.
  const tileY = mascotAt(compact, width).y - MASCOT_GAP - tileH;
  return (
    <>
      <Layer depth={70}>
        <At x={0} y={tileY - 16 - 68} w={width} h={68} pieceRef={banner} z={3}>
          <NotifyBanner title={t.notifyTitle} body={t.notifyCourse} bellRef={bell} />
        </At>
      </Layer>
      <Layer depth={-40}>
        <At x={0} y={tileY} w={tileW} h={tileH} pieceRef={left}>
          <Card dense className="flex h-full flex-col justify-center">
            <p className="text-m12 text-muted-foreground">{t.countdownLabel}</p>
            {/* The app's own countdown format, fixed-width digits, a real second every second. */}
            <p className="mt-1 text-m22 whitespace-nowrap text-primary tabular-nums">{formatCountdown(secs * 1000, 'id')}</p>
            {!compact && <p className="mt-1 text-m12 text-muted-foreground">{t.notifyTitle}</p>}
          </Card>
        </At>
        <At x={tileW + 12} y={tileY} w={tileW} h={tileH} pieceRef={right}>
          <Card dense className="flex h-full flex-col justify-center">
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
export function ScenePrivate({ w, compact, width, play, lead }: SceneProps) {
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
  const dataY = (i: number) => phone.y + 40 + i * 40;
  // The badges: one fixed width, each lying across the phone's outline by the
  // same amount (left ones over the left edge, the right one over the right
  // edge), evenly spaced, ending above the mascot.
  const BADGE_W = 126;
  const BADGE_H = 26;
  // Flush with the canvas edges (16 px from the screen), so all three overlap the outline by the same amount.
  const badgeX = (i: number) => (i % 2 ? width - BADGE_W : 0);
  const zone = mascotAt(compact, width).y - 6 - (compact ? 2 : 3) * (BADGE_H + 2);
  const tags = compact ? t.badges.slice(0, 2) : t.badges;

  // Before the first paint: the pieces are at their starting places in the very first frame.
  useLayoutEffect(() => {
    if (!play) return;
    // Base times before SCENE_TEMPO: the outline (to 640), a breath of 140,
    // the data cards one by one, the lock, then the badges one at a time.
    const anims: (Animation | null)[] = [];
    anims.push(
      act(outline.current, 640, [
        { at: 0, strokeDashoffset: 1, easing: EASE_STORY },
        { at: 640, strokeDashoffset: 0 },
      ], true, lead),
    );
    rows.forEach((_, i) => {
      const d = 780 + i * 100;
      const from = T(i % 2 ? 190 : -190, 0);
      anims.push(
        act(data.current[i] ?? null, d + 340, [
          { at: 0, opacity: 0, transform: from },
          { at: d, opacity: 0, transform: from, easing: EASE_STORY },
          { at: d + 340, opacity: 1, transform: T(0, 0) },
        ], true, lead),
      );
    });
    const lockAt = 780 + rows.length * 100 + 320;
    anims.push(
      act(lock.current, lockAt + 300, [
        { at: 0, opacity: 0, transform: 'translateY(-14px) scale(0.92)' },
        { at: lockAt, opacity: 0, transform: 'translateY(-14px) scale(0.92)', easing: EASE_SPRING },
        { at: lockAt + 300, opacity: 1, transform: 'translateY(0) scale(1)' },
      ], true, lead),
      act(shackle.current, lockAt + 480, [
        { at: 0, transform: 'translateY(-3.5px)' },
        { at: lockAt + 280, transform: 'translateY(-3.5px)', easing: EASE_STORY },
        { at: lockAt + 480, transform: 'translateY(0)' },
      ], true, lead),
    );
    tags.forEach((_, i) => {
      const d = lockAt + 380 + i * 150;
      const from = T(i % 2 ? 20 : -20, 0);
      anims.push(
        act(badges.current[i] ?? null, d + 300, [
          { at: 0, opacity: 0, transform: from },
          { at: d, opacity: 0, transform: from, easing: EASE_STORY },
          { at: d + 300, opacity: 1, transform: T(0, 0) },
        ], true, lead),
      );
    });
    const stop = schedule([
      ...rows.map((_, i) => [780 + i * 100, () => mascot.lookAt(data.current[i] ?? null, 400)] as const),
      [lockAt, () => mascot.lookAt(lock.current, 600)],
      [lockAt + 380, () => mascot.express('proud')],
    ], true, lead);
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
          <At key={label} x={phone.x + 28} y={dataY(i)} w={phone.w - 56} h={32} pieceRef={(n) => void (data.current[i] = n)}>
            <span className="m-card flex h-full items-center gap-2 rounded-ctl px-3 text-m13">
              <span aria-hidden="true" className="size-2 rounded-full" style={{ background: `var(--course-${[1, 4, 6][i]})` }} />
              {label}
            </span>
          </At>
        ))}
      </Layer>
      <Layer depth={64}>
        {tags.map((label, i) => (
          <At key={label} x={badgeX(i)} y={zone + i * (BADGE_H + 2)} w={BADGE_W} h={BADGE_H} pieceRef={(n) => void (badges.current[i] = n)} z={2}>
            <span className="flex h-full w-full items-center justify-center gap-1.5 rounded-full bg-m-inset text-m12 font-medium whitespace-nowrap">
              <CheckIcon aria-hidden="true" className="size-3.5" />
              {label}
            </span>
          </At>
        ))}
      </Layer>
    </>
  );
}

