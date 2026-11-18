// Screens 0, 4, 5 and 9 (M8c.2): the splash, sign-in, preparing and done.
// The mascot is the middle of each; the rest of the scene is arranged
// around it on the scene canvas.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { OnboardingWords } from '@sulo/core/i18n/mobile-onboarding';
import { ArrowLeftIcon, AttendanceIcon, CalendarIcon, EyeOffIcon, ShieldIcon, TasksIcon } from '@sulo/ui/dashboard-icons';
import { BellIcon, KeyIcon } from '@sulo/ui/icons';
import { Card, IconTile } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import { Sheet } from '@sulo/ui/mobile/sheet';
import { initials, ON_SOLID, tintVar } from '@sulo/ui/mobile/tint';
import { PrivasiScreen } from '../screens/Privasi';
import { act, burstSparks, ResultChip, schedule, useAfter, useCountUp } from './bits';
import { MascotSpot, useExpression, useMascot } from './FlyingMascot';
import { BackButton, Frame, TextBlock, TextLink, useTitleFocus } from './Frame';
import { haptic } from './haptics';
import { EASE_OUT, EASE_SPRING } from './motion';
import { At, Scene } from './Scene';
import { PREP_ROWS, shownTimes, type PrepRow, type StageEvent } from './stage-timing';

/** Screen 0: a spark grows into the flame, the eyes open with a wink, the name rises letter by letter; 1.6 s or a tap moves on. */
export function Splash({ w, next }: { w: OnboardingWords; next: () => void }) {
  const mascot = useMascot();
  const sparks = useRef<HTMLDivElement | null>(null);
  useExpression('neutral');
  useEffect(
    () =>
      schedule([
        [120, () => burstSparks(sparks.current, 8)],
        [620, () => mascot.flash('wink', 320)],
      ]),
    [mascot],
  );
  useAfter(1600, next, true);
  return (
    <Frame>
      <div className="flex flex-1 flex-col items-center justify-center text-center" onClick={next}>
        <div ref={sparks} className="relative">
          <MascotSpot size={176} />
        </div>
        <p aria-label={w.splash.name} className="onb-title mt-4">
          {[...w.splash.name].map((ch, i) => (
            <span key={i} aria-hidden="true" className="onb-letter inline-block" style={{ animationDelay: `${420 + i * 70}ms` }}>
              {ch}
            </span>
          ))}
        </p>
        <p className="onb-letter mt-1 text-m13 text-muted-foreground" style={{ animationDelay: '760ms' }}>
          {w.splash.tagline}
        </p>
      </div>
    </Frame>
  );
}

const WHY_ICONS = [KeyIcon, ShieldIcon, EyeOffIcon];

/** Screen 4: a large address bar over the mascot, its lock closing; "Masuk" raises the real SIKOLA page. */
export function SignIn({ w, note, busy, paused, onOpen, onBack }: { w: OnboardingWords; note: 'cancelled' | 'offline' | null; busy: boolean; paused: string | null; onOpen: () => void; onBack: (() => void) | null }) {
  const t = w.signin;
  const mascot = useMascot();
  const [why, setWhy] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const title = useTitleFocus('signin');
  const bar = useRef<HTMLDivElement | null>(null);
  const shackle = useRef<SVGPathElement | null>(null);
  useExpression('neutral');
  useEffect(() => {
    const a = act(shackle.current, 900, [
      { at: 0, transform: 'translateY(-4px)' },
      { at: 520, transform: 'translateY(-4px)', easing: EASE_SPRING },
      { at: 900, transform: 'translateY(0)' },
    ]);
    const b = act(bar.current, 420, [
      { at: 0, opacity: 0, transform: 'translateY(-16px)', easing: EASE_OUT },
      { at: 420, opacity: 1, transform: 'translateY(0)' },
    ]);
    const stop = schedule([
      [300, () => mascot.lookAt(bar.current, 1400)],
      [820, () => haptic('light')],
    ]);
    return () => {
      stop();
      a?.cancel();
      b?.cancel();
    };
  }, [mascot]);
  if (privacy) return <PrivacyPage w={w} onBack={() => setPrivacy(false)} />;
  const state = paused ?? (note === 'offline' ? t.offline : note === 'cancelled' ? t.cancelled : null);
  return (
    <>
      <Frame
        topLeft={onBack ? <BackButton label={w.back} onPress={onBack} /> : null}
        primary={{ label: t.open, onPress: onOpen, disabled: busy || paused !== null }}
        secondary={
          <>
            {state && (
              <p role="status" className="text-m12 text-muted-foreground">
                {state}
              </p>
            )}
            <TextLink onPress={() => setWhy(true)}>{t.why}</TextLink>
          </>
        }
      >
        <Scene label={t.address} h={452} compactH={316} top={!onBack}>
          {(compact, width) => (
            <>
              <At x={0} y={compact ? 20 : 16} w={width} pieceRef={bar}>
                <Card dense>
                  {/* The address, always whole: the user is asked to check it. */}
                  <div className="flex h-10 items-center gap-3 rounded-full bg-m-inset px-4">
                    <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="5" y="11" width="14" height="10" rx="2" />
                      <path ref={shackle} d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                    <span className="text-m15 font-medium whitespace-nowrap">{t.address}</span>
                  </div>
                  {!compact && (
                    // The page under the address: two fields and a button, as plain shapes.
                    <div className="mt-3 space-y-2 px-1 pb-1">
                      <div className="flex h-10 items-center rounded-ctl bg-m-inset px-3">
                        <span className="h-2 w-24 rounded-full bg-m-line" />
                      </div>
                      <div className="flex h-10 items-center gap-1.5 rounded-ctl bg-m-inset px-3">
                        {Array.from({ length: 8 }, (_, i) => (
                          <span key={i} className="size-2 rounded-full bg-muted-foreground" />
                        ))}
                      </div>
                      <div className="h-10 w-28 rounded-full bg-m-line" />
                    </div>
                  )}
                </Card>
              </At>
              <At x={(width - 168) / 2} y={compact ? 132 : 276}>
                <MascotSpot size={168} />
              </At>
            </>
          )}
        </Scene>
        <TextBlock title={t.title} body={t.body} titleRef={title} />
      </Frame>
      <Sheet open={why} onOpenChange={setWhy} title={t.why}>
        <ul className="space-y-2">
          {w.sheets.why.map((p, i) => (
            <li key={p} className="flex items-center gap-3 rounded-card bg-m-inset px-3 py-2">
              <IconTile color="neutral" icon={WHY_ICONS[i]!} />
              <p className="min-w-0 text-m13">{p}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <PillButton
            full
            onPress={() => {
              setWhy(false);
              setPrivacy(true);
            }}
          >
            {t.privacyLink}
          </PillButton>
        </div>
      </Sheet>
    </>
  );
}

function PrivacyPage({ w, onBack }: { w: OnboardingWords; onBack: () => void }) {
  const title = useTitleFocus('privacy');
  return (
    <main className="mx-auto h-dvh max-w-md overflow-y-auto px-4 pt-[env(safe-area-inset-top)] pb-[calc(24px+env(safe-area-inset-bottom))]">
      <div className="flex h-12 items-center">
        <button type="button" aria-label={w.back} onClick={onBack} className="m-hit inline-flex size-10 items-center justify-center rounded-full bg-m-inset outline-none focus-ring:ring-2 focus-ring:ring-focus">
          <ArrowLeftIcon aria-hidden="true" className="size-5" />
        </button>
        <h1 ref={title} tabIndex={-1} className="sr-only">
          {w.signin.privacyLink}
        </h1>
      </div>
      <PrivasiScreen />
    </main>
  );
}

export interface PrepCounts {
  tasks: number;
  courses: number;
}

/** Where each result chip sits around the mascot (full and compact canvas). */
const CHIP_AT: Record<PrepRow, { x: 'left' | 'right'; y: number; yc: number }> = {
  tasks: { x: 'left', y: 6, yc: 4 },
  courses: { x: 'right', y: 72, yc: 50 },
  calendar: { x: 'left', y: 424, yc: 276 },
  attendance: { x: 'right', y: 494, yc: 322 },
};

/**
 * Screen 5: the mascot at work. One status line follows the real sync
 * stages (stage-timing.ts), a four-part bar fills, and a chip with the real
 * number lands beside the mascot as each stage ends. No task: sad, the
 * chips go, "Coba lagi".
 */
export function Preparing({ w, events, counts, final, onDone, onRetry, onWithout }: { w: OnboardingWords; events: readonly StageEvent[]; counts: PrepCounts; final: 'pending' | 'ok' | 'partial' | 'failed'; onDone: () => void; onRetry: () => void; onWithout: () => void }) {
  const t = w.preparing;
  const mascot = useMascot();
  const title = useTitleFocus('preparing');
  const [now, setNow] = useState(() => performance.now());
  const shown = useMemo(() => shownTimes(events), [events]);
  const visible = shown.filter((s) => s.showAt <= now);
  const failed = final === 'failed';
  const allShown = final !== 'pending' && !failed && visible.length === PREP_ROWS.length;
  useExpression(failed ? 'sad' : 'busy');

  // Wake up for the next row's time.
  useEffect(() => {
    const next = shown.find((s) => s.showAt > now);
    if (!next) return;
    const id = window.setTimeout(() => setNow(performance.now()), Math.max(0, next.showAt - now));
    return () => window.clearTimeout(id);
  }, [shown, now]);

  // Done: relieved for a moment, then on.
  useEffect(() => {
    if (!allShown) return;
    mascot.flash('happy', 800);
    mascot.hop();
    const id = window.setTimeout(onDone, 700);
    return () => window.clearTimeout(id);
  }, [allShown, onDone, mascot]);

  const current = PREP_ROWS[Math.min(visible.length, PREP_ROWS.length - 1)]!;
  return (
    <Frame
      primary={failed ? { label: t.retry, onPress: onRetry } : null}
      primarySlot={
        <div role="progressbar" aria-label={t.title} aria-valuemin={0} aria-valuemax={PREP_ROWS.length} aria-valuenow={visible.length} className="mx-auto flex w-40 gap-1.5">
          {PREP_ROWS.map((row, i) => (
            <span key={row} className="h-1 flex-1 overflow-hidden rounded-full bg-m-line">
              <span className={`onb-seg block h-full w-full rounded-full bg-foreground ${i < visible.length ? 'is-on' : ''}`} />
            </span>
          ))}
        </div>
      }
      secondary={
        failed ? (
          <TextLink onPress={onWithout}>{t.without}</TextLink>
        ) : (
          // What is happening now, right under the bar; each new line fades in over the last.
          <span key={current} role="status" className="onb-status text-m13 text-muted-foreground">
            {t.stages[current]}
          </span>
        )
      }
    >
      <Scene label={t.title} h={536} compactH={366} top>
        {(compact, width) => (
          <>
            <At x={(width - (compact ? 168 : 176)) / 2} y={compact ? 100 : 180}>
              <MascotSpot size={compact ? 168 : 176} />
            </At>
            {!failed &&
              visible.map((v) => (
                <PrepChip key={v.row} row={v.row} ok={v.result === 'ok'} w={w} counts={counts} compact={compact} width={width} />
              ))}
          </>
        )}
      </Scene>
      <TextBlock title={t.title} body={failed ? t.failedTitle : undefined} titleRef={title} />
    </Frame>
  );
}

function PrepChip({ row, ok, w, counts, compact, width }: { row: PrepRow; ok: boolean; w: OnboardingWords; counts: PrepCounts; compact: boolean; width: number }) {
  const mascot = useMascot();
  const ref = useRef<HTMLDivElement | null>(null);
  const at = CHIP_AT[row];
  const n = useCountUp(row === 'tasks' ? counts.tasks : row === 'courses' ? counts.courses : 0, 500);
  useEffect(() => {
    const a = act(ref.current, 360, [
      { at: 0, opacity: 0, transform: `translate(${at.x === 'left' ? 48 : -48}px, ${at.y < 250 ? 36 : -36}px) scale(0.92)`, easing: EASE_SPRING },
      { at: 360, opacity: 1, transform: 'translate(0, 0) scale(1)' },
    ]);
    mascot.lookAt(ref.current, 500);
    haptic('light');
    return () => a?.cancel();
    // Lands once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A stage that did not come through says nothing here; it is tried again later.
  if (!ok) return null;
  const c = w.preparing.chips;
  const text = row === 'tasks' ? c.tasks(n) : row === 'courses' ? c.courses(n) : c[row];
  return (
    <At x={at.x === 'left' ? 4 : width - 4 - 180} y={compact ? at.yc : at.y} w={180} pieceRef={ref} className={`flex ${at.x === 'left' ? 'justify-start' : 'justify-end'}`}>
      <ResultChip>{text}</ResultChip>
    </At>
  );
}

export interface DoneTile {
  name: string;
  color: number | null;
}

/** Up to five tiles of 60 over the mascot (left, top): the middle ones high, the outer ones lower, like an arch. */
function arch(count: number, compact: boolean, width: number): { x: number; y: number }[] {
  const pitch = 66;
  return Array.from({ length: count }, (_, i) => {
    const off = i - (count - 1) / 2;
    // Three levels: the middle highest, the next pair lower, the outer pair lowest.
    const level = Math.min(2, Math.round(Math.abs(off)));
    return { x: width / 2 + off * pitch - 30, y: 6 + level * (compact ? 44 : 100) };
  });
}

/** Screen 9: the mascot celebrates once under an arc of the user's own courses; two chips count up from the real data. */
export function Done({ w, tiles, tasks, next, onOpen }: { w: OnboardingWords; tiles: readonly DoneTile[]; tasks: number; next: string | null; onOpen: () => void }) {
  const mascot = useMascot();
  const title = useTitleFocus('done');
  const sparks = useRef<HTMLDivElement | null>(null);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  // Fewer than four courses: the things that are ready fill the arch.
  const shown: (DoneTile | { icon: typeof BellIcon })[] = [...tiles.slice(0, 5), ...[{ icon: BellIcon }, { icon: CalendarIcon }, { icon: AttendanceIcon }, { icon: TasksIcon }, { icon: KeyIcon }].slice(0, Math.max(0, 5 - tiles.length))];
  const n = useCountUp(tasks, 700, true, 300);
  useExpression('happy');
  useEffect(() => {
    const anims = shown.map((_, i) =>
      act(refs.current[i] ?? null, 300 + i * 70 + 320, [
        { at: 0, opacity: 0, transform: 'translateY(40px) scale(0.92)' },
        { at: 300 + i * 70, opacity: 0, transform: 'translateY(40px) scale(0.92)', easing: EASE_SPRING },
        { at: 300 + i * 70 + 320, opacity: 1, transform: 'translateY(0) scale(1)' },
      ]),
    );
    const stop = schedule([
      [260, () => mascot.celebrate()],
      [300, () => burstSparks(sparks.current, 12)],
      [300, () => haptic('firm')],
    ]);
    return () => {
      stop();
      anims.forEach((a) => a?.cancel());
    };
    // Once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Frame primary={{ label: w.done.open, onPress: onOpen }}>
      <Scene label={w.done.title} h={486} compactH={300} top>
        {(compact, width) => {
          const size = compact ? 150 : 176;
          const spots = arch(shown.length, compact, width);
          return (
            <>
              {shown.map((tile, i) => (
                <At key={i} x={spots[i]!.x} y={spots[i]!.y} w={60} h={60} pieceRef={(node) => void (refs.current[i] = node)}>
                  {'icon' in tile ? (
                    <span className="m-card flex size-[60px] items-center justify-center rounded-card">
                      <tile.icon aria-hidden="true" className="size-6" />
                    </span>
                  ) : (
                    <span className="flex size-[60px] items-center justify-center rounded-card text-m18 font-semibold" style={tile.color ? { background: tintVar(`course-${tile.color}`), ...ON_SOLID } : { background: 'var(--m-inset)' }}>
                      {initials(tile.name)}
                    </span>
                  )}
                </At>
              ))}
              <At x={(width - size) / 2} y={compact ? 146 : 304} pieceRef={sparks}>
                <MascotSpot size={size} />
              </At>
            </>
          );
        }}
      </Scene>
      <TextBlock title={w.done.title} titleRef={title}>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {tasks > 0 ? (
            <>
              <ResultChip>{w.done.tasks(n)}</ResultChip>
              {next && <ResultChip>{w.done.next(next)}</ResultChip>}
            </>
          ) : (
            <ResultChip>{w.done.empty}</ResultChip>
          )}
        </div>
      </TextBlock>
    </Frame>
  );
}
