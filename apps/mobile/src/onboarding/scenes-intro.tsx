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
/** The gap between stacked cards: the card list's on Ringkasan (gap-3). */
export const STACK_GAP = 12;
/**
 * Free room kept above the stack, inside the canvas. None: with the 12 px gap, three cards at 100% (76 px each)
 * fill the 252 px above the mascot exactly (they used the canvas's top 8 px when the gap was 8).
 */
const STACK_TOP = 0;
const T = (x: number, y: number, r = 0) => `translate(${x}px, ${y}px) rotate(${r}deg)`;
/** Where each card comes from, and how it lies before the stack tidies itself (`p`: one slot down). */
const FROM = (p: number) => [T(-340, 0, -14), T(360, p, 12), T(-12, p + 220, -8)];
const MESSY = (p: number) => [T(-14, 8, -6), T(18, p + 4, 5), T(-8, p + 10, -3)];

/**
 * How many sample cards the stack shows, and its pitch, from the cards' own heights (they follow the phone's text
 * size, so they are measured, never assumed). As many as fit between the canvas top and the mascot, at most `max`,
 * at least one; every slot is as tall as the tallest card, so nothing ever lies over anything.
 */
export function stackFit(heights: readonly number[], room: number, max: number): { n: number; pitch: number } {
  for (let n = max; n >= 1; n--) {
    const tallest = Math.max(...heights.slice(0, n + 1));
    if (n * tallest + (n - 1) * STACK_GAP <= room || n === 1) return { n, pitch: tallest + STACK_GAP };
  }
  return { n: 1, pitch: Math.max(...heights.slice(0, 2)) + STACK_GAP };
}

/**
 * Each element's own box (offset sizes: the animations' transforms do not count), measured before the first paint
 * and again whenever one changes size. Pieces holding text follow the phone's text size, so a scene measures them
 * instead of assuming their size. null until every element has a size.
 */
function useSizes(refs: { current: (HTMLElement | null)[] }, count: number, deps: unknown[]): { w: number; h: number }[] | null {
  const [sizes, setSizes] = useState<{ w: number; h: number }[] | null>(null);
  useLayoutEffect(() => {
    const read = () => {
      const v = Array.from({ length: count }, (_, k) => ({ w: refs.current[k]?.offsetWidth ?? 0, h: refs.current[k]?.offsetHeight ?? 0 }));
      if (v.every((x) => x.h > 0)) setSizes((p) => (p && p.length === v.length && p.every((x, i) => Math.abs(x.h - v[i]!.h) < 0.5 && Math.abs(x.w - v[i]!.w) < 0.5) ? p : v));
    };
    read();
    const ro = new ResizeObserver(read);
    refs.current.slice(0, count).forEach((el) => el && ro.observe(el));
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return sizes;
}

/** Screen 1: real task cards arrive untidy from three sides, straighten into a stack, the top one is ticked and leaves, the next ones move up. */
export function SceneTasks({ w, compact, width, play, lead }: SceneProps) {
  const mascot = useMascot();
  const all = w.intro1.cards;
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const [done, setDone] = useState(false);
  // The cards' heights at this width and text size, measured before the first paint (and again when either changes).
  const [heights, setHeights] = useState<number[] | null>(null);
  useLayoutEffect(() => {
    const read = () => {
      const hs = all.map((_, k) => refs.current[k]?.offsetHeight ?? 0);
      if (hs.every((h) => h > 0)) setHeights((p) => (p && p.length === hs.length && p.every((v, i) => Math.abs(v - hs[i]!) < 0.5) ? p : hs));
    };
    read();
    const ro = new ResizeObserver(read);
    refs.current.forEach((el) => el && ro.observe(el));
    return () => ro.disconnect();
  }, [all, width]);
  // The stack ends 24 px above the mascot; the cards above it, as many as fit.
  const floor = mascotAt(compact, width).y - MASCOT_GAP;
  const { n, pitch } = stackFit(heights ?? all.map(() => 76), floor - STACK_TOP, compact ? 2 : 3);
  const slots = Array.from({ length: n }, (_, i) => floor - (n - i) * pitch + STACK_GAP);
  const from = FROM(pitch);
  const messy = MESSY(pitch);

  // Before the first paint: the pieces are at their starting places in the very first frame.
  useLayoutEffect(() => {
    if (!play) return;
    setDone(false);
    // Base times (ms) before SCENE_TEMPO. Acts, with a breath between them:
    // arrive untidy, hold, tidy (to 1140), rest 250, tick (1390), rest 180
    // after the tick lands, the top card leaves (1720), the others move up,
    // the next task rises. About 3.4 s at tempo 1.4.
    if (!heights) return;
    const total = 2450;
    const el = (i: number) => refs.current[i] ?? null;
    const anims: (Animation | null)[] = [];
    anims.push(
      act(el(0), total, [
        { at: 0, opacity: 0, transform: from[0]!, easing: EASE_STORY },
        { at: 420, opacity: 1, transform: messy[0]! },
        { at: 700, opacity: 1, transform: messy[0]!, easing: EASE_STORY },
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
          { at: 0, opacity: 0, transform: from[k]! },
          { at: d, opacity: 0, transform: from[k]!, easing: EASE_STORY },
          { at: d + 420, opacity: 1, transform: messy[k]! },
          { at: 700 + k * 40, opacity: 1, transform: messy[k]!, easing: EASE_STORY },
          { at: 1060 + k * 40, opacity: 1, transform: T(0, pitch) },
          { at: 1800 + k * 50, opacity: 1, transform: T(0, pitch), easing: EASE_STORY },
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
    // Plays once per showing, once the cards are measured.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, heights === null]);

  return (
    <Layer>
      {all.map((c, k) => (
        // Card 0 has left by the end; the others rest one slot up. Cards past the stack stay off the picture (measured only).
        <At key={c.title} x={0} y={k <= n ? slots[Math.max(0, k - 1)]! : 0} w={width} z={n + 1 - k} pieceRef={(node) => void (refs.current[k] = node)} className={k === 0 || k > n || !heights ? 'opacity-0' : ''} hidden={k > n}>
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
  // The countdown is real: it loses a second every second while its page shows (not on the pages beside it).
  const [secs, setSecs] = useState(3 * 3600 + 59 * 60 + 58);
  useEffect(() => {
    if (!play) return;
    const id = window.setInterval(() => document.visibilityState !== 'hidden' && setSecs((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [play]);

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

  // The banner's and the tiles' contents, measured: the tiles are as tall as the taller one's content (at least their
  // drawn size), the banner as tall as its own.
  const parts = useRef<(HTMLDivElement | null)[]>([]);
  const sizes = useSizes(parts, 3, [width, compact]);
  const minTile = compact ? 84 : 136;
  const tileH = Math.max(minTile, sizes ? Math.max(sizes[1]?.h ?? 0, sizes[2]?.h ?? 0) + 28 : 0);
  const bannerH = sizes?.[0]?.h ?? 68;
  const tileW = (width - 12) / 2;
  // Two tiles 24 px above the mascot, the banner 16 px above them (above the canvas, if large text needs it: the
  // stage then fits the scene's whole height, Scene.tsx).
  const tileY = mascotAt(compact, width).y - MASCOT_GAP - tileH;
  return (
    <>
      <Layer depth={70}>
        <At x={0} y={tileY - 16 - bannerH} w={width} pieceRef={banner} z={3}>
          <div ref={(n) => void (parts.current[0] = n)}>
            <NotifyBanner title={t.notifyTitle} body={t.notifyCourse} bellRef={bell} />
          </div>
        </At>
      </Layer>
      <Layer depth={-40}>
        <At x={0} y={tileY} w={tileW} h={tileH} pieceRef={left}>
          <Card dense className="flex h-full flex-col justify-center">
            <div ref={(n) => void (parts.current[1] = n)} className="min-w-0">
              <p className="text-m12 text-muted-foreground">{t.countdownLabel}</p>
              {/* The app's own countdown format, fixed-width digits, a real second every second. */}
              <p className="mt-1 text-m22 m-num-fit whitespace-nowrap text-primary tabular-nums">{formatCountdown(secs * 1000, 'id')}</p>
              {!compact && <p className="mt-1 line-clamp-2 text-m12 text-muted-foreground">{t.notifyTitle}</p>}
            </div>
          </Card>
        </At>
        <At x={tileW + 12} y={tileY} w={tileW} h={tileH} pieceRef={right}>
          <Card dense className="flex h-full flex-col justify-center">
            <div ref={(n) => void (parts.current[2] = n)} className="min-w-0">
              <p className="text-m12 text-muted-foreground">{t.attendanceLabel}</p>
              {/* The ring and its number side by side while they fit, the number under the ring when they do not. */}
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <ProgressRing value={ring} size={compact ? 48 : 64} stroke={compact ? 6 : 7} label={`${ring}%`} />
                <span className="text-m22 tabular-nums">{ring}%</span>
              </div>
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
  // The data rows and the badges, measured (they hold text, which follows the phone's text size).
  const allRows = compact ? t.data.slice(0, 2) : t.data;
  const tags = compact ? t.badges.slice(0, 2) : t.badges;
  const sizes = useSizes(data as { current: (HTMLElement | null)[] }, allRows.length, [width, compact]);
  const tagSizes = useSizes(badges as { current: (HTMLElement | null)[] }, tags.length, [width, compact]);
  // The badges: each lying across the phone's outline (left ones over the left edge, the right one over the right
  // edge), 2 px apart, ending 6 px above the mascot; at least 126 wide, wider for longer text.
  const BADGE_W = 126;
  const tagH = (i: number) => tagSizes?.[i]?.h ?? 26;
  const tagW = (i: number) => Math.max(BADGE_W, tagSizes?.[i]?.w ?? BADGE_W);
  // Flush with the canvas edges (16 px from the screen), so all of them overlap the outline by the same amount.
  const badgeX = (i: number) => (i % 2 ? width - tagW(i) : 0);
  const tagsH = tags.reduce((sum, _, i) => sum + tagH(i) + 2, 0);
  const zone = mascotAt(compact, width).y - 6 - tagsH;
  const tagY = (i: number) => zone + tags.slice(0, i).reduce((sum, _, k) => sum + tagH(k) + 2, 0);
  // The rows from the top of the phone, 8 px apart: as many as stay clear of the badges (at least one).
  const rowH = (i: number) => sizes?.[i]?.h ?? 32;
  const dataY = (i: number) => phone.y + 40 + allRows.slice(0, i).reduce((sum, _, k) => sum + rowH(k) + 8, 0);
  let shown = allRows.length;
  while (shown > 1 && dataY(shown - 1) + rowH(shown - 1) > zone - 8) shown -= 1;
  const rows = allRows.slice(0, shown);

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
    if (!sizes || !tagSizes) return;
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
    // Plays once per showing, once the pieces are measured.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, sizes === null || tagSizes === null]);

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
            {/* overflow-visible: while it is open the shackle is raised past the top of the icon's own box, and must not be cut off there. */}
            <svg viewBox="0 0 24 24" className="size-5 overflow-visible" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path ref={shackle} d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </span>
        </At>
      </Layer>
      <Layer depth={-36}>
        {allRows.map((label, i) => (
          // Rows past those that fit stay laid out (measured) but off the picture.
          <At key={label} x={phone.x + 28} y={dataY(i)} w={phone.w - 56} pieceRef={(n) => void (data.current[i] = n)} hidden={i >= shown}>
            <span className="m-card flex min-h-8 items-center gap-2 rounded-ctl px-3 py-1 text-m13">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: `var(--course-${[1, 4, 6][i]})` }} />
              <span className="min-w-0 break-words">{label}</span>
            </span>
          </At>
        ))}
      </Layer>
      <Layer depth={64}>
        {tags.map((label, i) => (
          <At key={label} x={badgeX(i)} y={tagY(i)} pieceRef={(n) => void (badges.current[i] = n)} z={2}>
            <span className="flex min-h-[26px] items-center justify-center gap-1.5 rounded-full bg-m-inset px-3 text-m12 font-medium whitespace-nowrap" style={{ minWidth: BADGE_W }}>
              <CheckIcon aria-hidden="true" className="size-4" />
              {label}
            </span>
          </At>
        ))}
      </Layer>
    </>
  );
}

