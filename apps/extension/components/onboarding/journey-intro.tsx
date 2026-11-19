// The intro's three pages and "Kenapa aman?" (Tahap 2, second layout). Each
// scene is at most four pieces at their real size, one of them the focus,
// and it owns the mascot's expression (it knows when its moments happen).
// Synthetic sample data only; no technical terms.
//   1. three task cards (four at 1440x900); the top one is ticked, leaves,
//      the others move up and the next task rises (the phone's choreography,
//      kept straight)
//   2. one reminder banner lands with a small bounce, then a countdown and the
//      attendance ring side by side
//   3. a browser window drawn as an outline, three data chips inside, a lock
//      closing on its top edge, three short badges on its bottom edge

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type SVGProps } from 'react';
import { formatCountdown } from '@sulo/core/format/countdown';
import { extOnboardingWords } from '@sulo/core/i18n/ext-onboarding';
import { useI18n } from '@sulo/ui/i18n';
import { BellIcon, CheckIcon, KeyIcon } from '@sulo/ui/icons';
import { Chip } from '@sulo/ui/mobile/cards';
import { ProgressRing } from '@sulo/ui/mobile/ring';
import { TaskCardView } from '@sulo/ui/mobile/task-card';
import { courseTint } from '@sulo/ui/mobile/tint';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@sulo/ui/ui/alert-dialog';
import { Button } from '@sulo/ui/ui/button';
import { BackCircle, JActions, JAfter, JLine, JLink, JTitle, sceneLevel, story, useMascot, useRoomy } from './journey';

const words = (locale: 'id' | 'en') => extOnboardingWords(locale);
const EASE_STORY = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/** A scene piece arriving, `i`-th in its scene (story motion; at once at the simple level; still under reduced motion). */
export function In({ i, children, className = '', delay = 140 }: { i: number; children: ReactNode; className?: string; delay?: number }) {
  const level = sceneLevel();
  if (level === 'still') return <div className={className}>{children}</div>;
  const at = level === 'simple' ? 0 : story(delay * i);
  return (
    <div className={`obj-in ${className}`} style={{ ['--obj-delay' as string]: `${at}ms`, ['--obj-dur' as string]: `${story(level === 'simple' ? 220 : 360)}ms` }}>
      {children}
    </div>
  );
}

/** Runs keyframes on an element at story tempo; null when there is nothing to animate. */
function play(el: Element | null | undefined, frames: Keyframe[], ms: number, delay = 0, easing = EASE_STORY): Animation | null {
  if (!el || typeof (el as HTMLElement).animate !== 'function') return null;
  return (el as HTMLElement).animate(frames, { duration: story(ms), delay: story(delay), easing, fill: 'both' });
}

// ---------- 1. Every deadline, one place ----------

const TONE: Record<string, string> = { overdue: 'text-urgency-overdue', soon: 'text-urgency-soon', later: 'text-muted-foreground' };
const COLORS = [1, 4, 6, 3, 5];
const GAP = 12;
/** Base times (ms, before SCENE_TEMPO): the cards arrive, the top one is ticked, it leaves, the others move up, the next one rises. */
const TICK_AT = 1390;
const LEAVE_AT = 1720;

function SceneTasks() {
  const { locale } = useI18n();
  const { phone, ext } = words(locale);
  const roomy = useRoomy();
  const n = roomy ? 4 : 3;
  const cards = [...phone.intro1.cards, ...ext.scene.moreCards].slice(0, n + 1);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const [h, setH] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const level = sceneLevel();
  useMascot({ state: 'idle', lookMs: level === 'full' ? story(TICK_AT) : 0, then: 'all-done' });

  // One card's height, measured once from the plain stack.
  useLayoutEffect(() => {
    if (h === null) setH(refs.current[0]?.offsetHeight ?? 76);
  }, [h]);

  useLayoutEffect(() => {
    if (h === null) return;
    if (level !== 'full') return setDone(true);
    const pitch = h + GAP;
    const el = (i: number) => refs.current[i];
    const anims: (Animation | null)[] = [];
    for (let k = 0; k < n; k++) anims.push(play(el(k), [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], 420, 100 * k));
    anims.push(play(el(0), [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(340px)' }], 220, LEAVE_AT, 'cubic-bezier(0.4, 0, 1, 1)'));
    for (let k = 1; k < n; k++) anims.push(play(el(k), [{ transform: 'none' }, { transform: `translateY(${-pitch}px)` }], 360, LEAVE_AT + 80 + 50 * k));
    anims.push(play(el(n), [{ opacity: 0, transform: `translateY(${-pitch + 56}px)` }, { opacity: 1, transform: `translateY(${-pitch}px)` }], 360, LEAVE_AT + 320));
    const tick = window.setTimeout(() => setDone(true), story(TICK_AT));
    return () => {
      window.clearTimeout(tick);
      anims.forEach((a) => a?.cancel());
    };
  }, [h, n, level]);

  const card = (c: (typeof cards)[number], k: number) => (
    <TaskCardView course={c.course} color={courseTint(COLORS[k % COLORS.length]!)} title={c.title} relative={c.due} tone={k === 0 && done ? 'text-muted-foreground' : (TONE[c.tone] ?? '')} done={k === 0 && done} doneLabel={c.title} onDone={() => undefined} />
  );
  if (h === null) {
    return (
      <div className="obj-scene pointer-events-none">
        {cards.slice(0, n).map((c, k) => (
          <div key={c.title} ref={(node) => void (refs.current[k] = node)}>
            {card(c, k)}
          </div>
        ))}
      </div>
    );
  }
  const pitch = h + GAP;
  // At rest (and at the simple level or under reduced motion): the first card has gone, the others one slot up.
  const still = level !== 'full';
  return (
    <div className="obj-scene pointer-events-none relative" style={{ height: n * pitch - GAP }}>
      {cards.map((c, k) => (
        <div
          key={c.title}
          ref={(node) => void (refs.current[k] = node)}
          className="absolute inset-x-0"
          style={{ top: k * pitch, zIndex: n + 1 - k, ...(still ? (k === 0 ? { opacity: 0 } : { transform: `translateY(${-pitch}px)` }) : k === n ? { opacity: 0 } : {}) }}
        >
          {card(c, k)}
        </div>
      ))}
    </div>
  );
}

// ---------- 2. Reminded before it's late ----------

function SceneRemind() {
  const { locale } = useI18n();
  const { phone } = words(locale);
  const w = phone.intro2;
  const banner = useRef<HTMLDivElement>(null);
  const level = sceneLevel();
  // It looks up left as the banner falls, then is pleased.
  useMascot({ state: 'idle', look: { x: -1, y: -1 }, lookMs: level === 'full' ? story(700) : 0, then: 'all-done' });
  // A real countdown from core, ticking while the page shows (4 hours 12 minutes from now).
  const [left, setLeft] = useState(4 * 3600_000 + 12 * 60_000 + 30_000);
  useEffect(() => {
    if (level === 'still') return;
    const t = window.setInterval(() => setLeft((v) => Math.max(0, v - 1000)), 1000);
    return () => window.clearInterval(t);
  }, [level]);
  // The banner lands with a small bounce.
  useLayoutEffect(() => {
    if (level !== 'full') return;
    const a = play(banner.current, [
      { opacity: 0, transform: 'translateY(-48px)' },
      { opacity: 1, transform: 'translateY(4px)', offset: 0.7 },
      { opacity: 1, transform: 'none' },
    ], 520, 0, 'cubic-bezier(0.3, 0.7, 0.4, 1)');
    return () => a?.cancel();
  }, [level]);
  return (
    <div className="obj-scene pointer-events-none">
      <div ref={banner} className="m-card rounded-card flex w-full items-center gap-3 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--layer-inset)' }}>
          <BellIcon className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{w.notifyTitle}</span>
          <span className="mt-1 flex items-center gap-2 text-[12px]">
            <Chip small color={courseTint(4)}>
              {w.notifyCourse}
            </Chip>
            <span className="text-urgency-soon">{phone.intro1.cards[1]!.due}</span>
          </span>
        </span>
      </div>
      {/* Two tiles as tall as their content, the same height: the label, then 8 below it the value
          (the countdown in orange, ticking; the attendance ring and its percentage). */}
      <div className="grid w-full grid-cols-2 gap-3">
        <In i={4}>
          <div className="m-card rounded-card flex flex-col gap-2 p-4">
            <p className="text-[13px] leading-[18px] text-muted-foreground">{w.countdownLabel}</p>
            <p className="db-accent-text flex h-9 items-center text-[24px] leading-9 font-semibold whitespace-nowrap tabular-nums">{formatCountdown(left, locale)}</p>
          </div>
        </In>
        <In i={5}>
          <div className="m-card rounded-card flex flex-col gap-2 p-4">
            <p className="text-[13px] leading-[18px] text-muted-foreground">{w.attendanceLabel}</p>
            <span className="flex h-9 items-center gap-3">
              <ProgressRing value={86} size={36} stroke={5} label={`${w.attendanceLabel} 86%`} />
              <span className="text-[24px] leading-9 font-semibold tabular-nums">86%</span>
            </span>
          </div>
        </In>
      </div>
    </div>
  );
}

// ---------- 3. Data stays in your browser ----------

/** The lock on the window's top edge; its shackle closes once the chips are in. */
function ClosingLock() {
  const shackle = useRef<SVGPathElement>(null);
  useLayoutEffect(() => {
    if (sceneLevel() !== 'full') return;
    const a = play(shackle.current, [{ transform: 'translateY(-4px)' }, { transform: 'none' }], 240, 900, 'cubic-bezier(0.5, 0, 0.6, 1.4)');
    return () => a?.cancel();
  }, []);
  return (
    <span className="absolute -top-5 left-1/2 flex size-10 -translate-x-1/2 items-center justify-center rounded-full" style={{ background: 'var(--layer-screen)' }}>
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path ref={shackle} d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    </span>
  );
}

function ScenePrivate() {
  const { locale } = useI18n();
  const { ext } = words(locale);
  const w = ext.intro3;
  useMascot({ state: 'idle', lookMs: sceneLevel() === 'full' ? story(1100) : 0, then: 'all-done' });
  return (
    <div className="obj-scene pointer-events-none pt-5 pb-4">
      <div className="relative h-[300px] rounded-[20px] border-2" style={{ borderColor: 'color-mix(in oklab, var(--foreground) 22%, transparent)' }}>
        {/* The window's bar: three small dots. */}
        <div className="flex h-10 items-center gap-1.5 px-4">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-2 rounded-full" style={{ background: 'color-mix(in oklab, var(--foreground) 22%, transparent)' }} />
          ))}
        </div>
        <div className="flex h-[212px] flex-wrap items-center justify-center gap-3 px-6">
          {w.data.map((d, i) => (
            <In key={d} i={i + 1} delay={160}>
              <Chip>{d}</Chip>
            </In>
          ))}
        </div>
        <ClosingLock />
        {/* Three badges, in turn, each on the bottom line by the same overlap. */}
        <div className="absolute inset-x-0 -bottom-4 flex justify-center gap-3">
          {w.badges.map((b, i) => (
            <In key={b} i={i + 5} delay={160}>
              <span className="m-card inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium whitespace-nowrap">
                <CheckIcon className="size-3.5 text-muted-foreground" />
                {b}
              </span>
            </In>
          ))}
        </div>
      </div>
    </div>
  );
}

const INTRO_SCENES = [SceneTasks, SceneRemind, ScenePrivate] as const;
export const INTRO_PAGES = INTRO_SCENES.length;

export function introScene(page: number): ReactNode {
  const Scene = INTRO_SCENES[page]!;
  return <Scene key={page} />;
}

export function IntroText({ page, onNext, onGo, onBack, onWhy }: { page: number; onNext: () => void; onGo: (page: number) => void; onBack?: () => void; onWhy: () => void }) {
  const { locale } = useI18n();
  const { phone, ext } = words(locale);
  const text = [phone.intro1, phone.intro2, ext.intro3][page]!;
  const last = page === INTRO_PAGES - 1;
  return (
    <>
      <JTitle id="ob-title">{text.title}</JTitle>
      <JLine>{text.body}</JLine>
      <JActions>
        {onBack && <BackCircle onClick={onBack} />}
        <Button onClick={onNext}>{last ? phone.intro3.start : phone.next}</Button>
      </JActions>
      {last && <JLink onClick={onWhy}>{ext.why}</JLink>}
      {/* The pages, as on the phone: the current dot longer; each one goes to its page. */}
      <JAfter>
        <div role="tablist" aria-label={phone.pageOf(page + 1, INTRO_PAGES)} className="-ml-1 flex items-center gap-1">
          {Array.from({ length: INTRO_PAGES }, (_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === page}
              aria-label={phone.pageOf(i + 1, INTRO_PAGES)}
              onClick={() => onGo(i)}
              className="flex h-6 items-center justify-center rounded-full px-1 outline-none focus-ring:ring-2 focus-ring:ring-focus"
            >
              <span className={`block h-1.5 rounded-full transition-[width,opacity] duration-150 ${i === page ? 'w-5 bg-foreground' : 'w-1.5 bg-foreground/30'}`} />
            </button>
          ))}
        </div>
        <p className="sr-only" aria-live="polite">
          {phone.pageOf(page + 1, INTRO_PAGES)}
        </p>
      </JAfter>
    </>
  );
}

// ---------- "Kenapa aman?" ----------

type IconProps = SVGProps<SVGSVGElement>;
const Line = ({ children, ...p }: IconProps & { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    {children}
  </svg>
);
const BrowserIcon = (p: IconProps) => (
  <Line {...p}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M3 9h18M7 6.5h.01M10 6.5h.01" />
  </Line>
);
const EyeIcon = (p: IconProps) => (
  <Line {...p}>
    <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.5" />
  </Line>
);
const NoServerIcon = (p: IconProps) => (
  <Line {...p}>
    <rect x="4" y="4" width="16" height="6" rx="2" />
    <rect x="4" y="14" width="16" height="6" rx="2" />
    <path d="M3 3l18 18" />
  </Line>
);

export function WhyDialog({ open, onOpenChange, outdated, onPrivacy }: { open: boolean; onOpenChange: (v: boolean) => void; outdated?: string; onPrivacy: () => void }) {
  const { locale } = useI18n();
  const { ext } = words(locale);
  const points = [
    [BrowserIcon, ext.whyPoints.browser],
    [KeyIcon, ext.whyPoints.password],
    [EyeIcon, ext.whyPoints.read],
    [NoServerIcon, ext.whyPoints.server],
  ] as const;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[440px] p-6" style={{ borderRadius: 16 }}>
        <AlertDialogTitle className="text-[20px] leading-7 font-bold">{ext.why}</AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div className="mt-4 text-[14px] leading-5 text-foreground">
            {outdated && <p className="mb-4 font-medium">{outdated}</p>}
            <ul className="grid gap-4">
              {points.map(([Icon, text]) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--layer-inset)' }}>
                    <Icon className="size-4" />
                  </span>
                  <span className="pt-1.5">{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </AlertDialogDescription>
        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" onClick={onPrivacy} className="rounded-sm text-[14px] font-medium underline underline-offset-4 outline-none focus-ring:ring-2 focus-ring:ring-focus">
            {ext.privacyLink}
          </button>
          <AlertDialogCancel asChild>
            <Button className="h-10 min-w-[96px] rounded-full px-5">{ext.close}</Button>
          </AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

