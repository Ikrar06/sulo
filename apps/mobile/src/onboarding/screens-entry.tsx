// Screens 0, 4, 5 and 9 (M8c.2): the splash, sign-in, preparing and done.
// The mascot is the middle of each; the rest of the scene is arranged
// around it on the scene canvas.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { OnboardingWords } from '@sulo/core/i18n/mobile-onboarding';
import { ArrowLeftIcon, EyeOffIcon, ShieldIcon } from '@sulo/ui/dashboard-icons';
import { KeyIcon } from '@sulo/ui/icons';
import { Card, IconTile } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import { Sheet } from '@sulo/ui/mobile/sheet';
import { initials, ON_SOLID, tintVar } from '@sulo/ui/mobile/tint';
import { PrivasiScreen } from '../screens/Privasi';
import { act, burstSparks, ResultChip, schedule, useAfter, useCountUp } from './bits';
import { MascotSpot, useExpression, useMascot } from './FlyingMascot';
import { BackButton, Frame, TextBlock, TextLink, useTitleFocus } from './Frame';
import { haptic } from './haptics';
import { EASE_OUT, EASE_SPRING, EASE_STORY, reducedMotion, SCENE_TEMPO_DEFAULT, sceneTempo, SHORT_SCREEN, simpleScenes } from './motion';
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
  // 1.6 s at the default tempo.
  useAfter((1600 / SCENE_TEMPO_DEFAULT) * sceneTempo(), next, true);
  return (
    <Frame>
      <div className="flex flex-1 flex-col items-center justify-center text-center" onClick={next}>
        <div ref={sparks} className="relative">
          <MascotSpot size={176} />
        </div>
        <p aria-label={w.splash.name} className="onb-title mt-4">
          {[...w.splash.name].map((ch, i) => (
            <span key={i} aria-hidden="true" className="onb-letter inline-block" style={{ animationDelay: `${(420 + i * 100) * sceneTempo()}ms`, animationDuration: `${360 * sceneTempo()}ms` }}>
              {ch}
            </span>
          ))}
        </p>
        <p className="onb-letter mt-1 text-m13 text-muted-foreground" style={{ animationDelay: `${820 * sceneTempo()}ms`, animationDuration: `${360 * sceneTempo()}ms` }}>
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
  useLayoutEffect(() => {
    const a = act(
      shackle.current,
      900,
      [
        { at: 0, transform: 'translateY(-4px)' },
        { at: 520, transform: 'translateY(-4px)', easing: EASE_SPRING },
        { at: 900, transform: 'translateY(0)' },
      ],
      false,
    );
    const b = act(
      bar.current,
      420,
      [
        { at: 0, opacity: 0, transform: 'translateY(-16px)', easing: EASE_OUT },
        { at: 420, opacity: 1, transform: 'translateY(0)' },
      ],
      false,
    );
    const stop = schedule(
      [
        [300, () => mascot.lookAt(bar.current, 1400)],
        [820, () => haptic('light')],
      ],
      false,
    );
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

/** The chips sit in a fixed pattern close around the mascot: two above, two below, mirrored, 16 px from it. */
const CHIP_SLOT: Record<PrepRow, { side: -1 | 1; row: 0 | 1 }> = {
  tasks: { side: -1, row: 0 },
  courses: { side: 1, row: 0 },
  calendar: { side: -1, row: 1 },
  attendance: { side: 1, row: 1 },
};
const CHIP_H = 40;
const CHIP_GAP = 16;

/**
 * Screen 5: the mascot at work. One status line follows the real sync
 * stages (stage-timing.ts) under a four-part bar, and a chip with the real
 * number comes out of the mascot as each stage ends. No task: sad, the
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
    mascot.flash('happy', 900);
    mascot.hop();
    const id = window.setTimeout(onDone, 650 * sceneTempo());
    return () => window.clearTimeout(id);
  }, [allShown, onDone, mascot]);

  const current = PREP_ROWS[Math.min(visible.length, PREP_ROWS.length - 1)]!;
  const size = SHORT_SCREEN ? 150 : 176;
  const h = CHIP_H * 2 + CHIP_GAP * 2 + size;
  return (
    <Frame
      primary={failed ? { label: t.retry, onPress: onRetry } : null}
      primarySlot={
        // The bar, about 60 % of the screen wide and 4 thick; what is happening now right under it.
        <div className="mx-auto flex w-[60vw] max-w-[260px] flex-col items-center">
          <div role="progressbar" aria-label={t.title} aria-valuemin={0} aria-valuemax={PREP_ROWS.length} aria-valuenow={visible.length} className="flex w-full gap-1.5">
            {PREP_ROWS.map((row, i) => (
              <span key={row} className="h-[4px] flex-1 overflow-hidden rounded-full bg-m-line">
                <span className={`onb-seg block h-full w-full rounded-full bg-foreground ${i < visible.length ? 'is-on' : ''}`} />
              </span>
            ))}
          </div>
          <span key={current} role="status" className="onb-status mt-[12px] text-m13 text-muted-foreground">
            {t.stages[current]}
          </span>
        </div>
      }
      secondary={failed ? <TextLink onPress={onWithout}>{t.without}</TextLink> : null}
    >
      <Scene label={t.title} h={h} compactH={h}>
        {(_compact, width) => (
          <>
            <At x={(width - size) / 2} y={CHIP_H + CHIP_GAP}>
              <MascotSpot size={size} />
            </At>
            {!failed &&
              visible.map((v) => (
                <PrepChip key={v.row} row={v.row} ok={v.result === 'ok'} w={w} counts={counts} width={width} size={size} />
              ))}
          </>
        )}
      </Scene>
      <TextBlock title={t.title} body={failed ? t.failedTitle : undefined} titleRef={title} />
    </Frame>
  );
}

function PrepChip({ row, ok, w, counts, width, size }: { row: PrepRow; ok: boolean; w: OnboardingWords; counts: PrepCounts; width: number; size: number }) {
  const mascot = useMascot();
  const ref = useRef<HTMLDivElement | null>(null);
  const slot = CHIP_SLOT[row];
  const n = useCountUp(row === 'tasks' ? counts.tasks : row === 'courses' ? counts.courses : 0, 420);
  // Half the canvas each, meeting 6 px either side of the middle; never nearer than the canvas edge (16 px from the screen).
  const half = width / 2 - 6;
  const y = slot.row === 0 ? 0 : CHIP_H + CHIP_GAP * 2 + size;
  useLayoutEffect(() => {
    // Out of the mascot: from its middle to the chip's place.
    const from = `translate(${-slot.side * (half / 2)}px, ${slot.row === 0 ? size / 2 + CHIP_GAP : -(size / 2 + CHIP_GAP)}px) scale(0.92)`;
    const a = act(ref.current, 380, [
      { at: 0, opacity: 0, transform: from, easing: EASE_STORY },
      { at: 120, opacity: 1 },
      { at: 380, opacity: 1, transform: 'translate(0, 0) scale(1)' },
    ]);
    mascot.lookAt(ref.current, 600);
    haptic('light');
    return () => a?.cancel();
    // Comes out once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A stage that did not come through says nothing here; it is tried again later.
  if (!ok) return null;
  const c = w.preparing.chips;
  const text = row === 'tasks' ? c.tasks(n) : row === 'courses' ? c.courses(n) : c[row];
  return (
    <At x={slot.side < 0 ? 0 : width / 2 + 6} y={y} w={half} h={CHIP_H} pieceRef={ref} className={`flex ${slot.side < 0 ? 'justify-end' : 'justify-start'}`}>
      <ResultChip>{text}</ResultChip>
    </At>
  );
}

export interface DoneTile {
  name: string;
  color: number | null;
}

/** Screen 9: the mascot celebrates once; the user's own courses fly out of it and are gone within 900 ms; what stays is the mascot, the title and two chips that count up from the real data. */
/** The done screen's celebration lasts at least this long (the mascot's star eyes and the sparks). */
export const DONE_CELEBRATION_MS = 1600;

export function Done({ w, tiles, tasks, next, onOpen, onCelebrated }: { w: OnboardingWords; tiles: readonly DoneTile[]; tasks: number; next: string | null; onOpen: () => void; /** The celebration is over (burst, sparks, the mascot's star eyes): heavy work may start now. */ onCelebrated?: () => void }) {
  const mascot = useMascot();
  const title = useTitleFocus('done');
  const host = useRef<HTMLDivElement | null>(null);
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  const burst = tiles.slice(0, 6);
  const celebrated = useRef(onCelebrated);
  celebrated.current = onCelebrated;
  const [flying, setFlying] = useState(() => !reducedMotion() && !simpleScenes() && burst.length > 0);
  const n = useCountUp(tasks, 500, true, 300);
  const size = SHORT_SCREEN ? 150 : 176;
  useExpression('happy');
  useLayoutEffect(() => {
    // Part of the celebration only: out of the mascot, fading, gone in 900 ms.
    const anims = burst.map((_, i) => {
      const a = -Math.PI / 2 + (i - (burst.length - 1) / 2) * 0.52;
      const x = Math.cos(a) * 150;
      const y = Math.sin(a) * 150;
      return refs.current[i]?.animate(
        [
          { opacity: 0, transform: 'translate(0, 0) scale(0.92)' },
          { opacity: 1, transform: `translate(${x * 0.7}px, ${y * 0.7}px) scale(1)`, offset: 0.35 },
          { opacity: 1, transform: `translate(${x * 0.95}px, ${y * 0.95}px) scale(1)`, offset: 0.7 },
          { opacity: 0, transform: `translate(${x}px, ${y - 8}px) scale(0.96)` },
        ],
        { duration: 900, delay: 260 + i * 40, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' },
      );
    });
    const gone = window.setTimeout(() => setFlying(false), 260 + burst.length * 40 + 920);
    // After the last of it (the burst, else the sparks and the star eyes): Ringkasan may be mounted underneath.
    const over = window.setTimeout(() => celebrated.current?.(), Math.max(DONE_CELEBRATION_MS, burst.length > 0 ? 260 + burst.length * 40 + 920 : 0));
    const stop = schedule([
      [200, () => mascot.celebrate()],
      [240, () => burstSparks(host.current, 12)],
      [240, () => haptic('firm')],
    ]);
    return () => {
      stop();
      window.clearTimeout(gone);
      window.clearTimeout(over);
      anims.forEach((a) => a?.cancel());
    };
    // Once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Frame primary={{ label: w.done.open, onPress: onOpen }}>
      {/* The group (mascot, title, chips) sits in the middle of the stage. */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        <div ref={host} className="relative">
          <MascotSpot size={size} />
          {flying &&
            burst.map((tile, i) => (
              <span key={i} ref={(node) => void (refs.current[i] = node)} aria-hidden="true" className="absolute top-1/2 left-1/2 -mt-6 -ml-6 flex size-12 items-center justify-center rounded-ctl text-m15 font-semibold opacity-0" style={tile.color ? { background: tintVar(`course-${tile.color}`), ...ON_SOLID } : { background: 'var(--m-inset)' }}>
                {initials(tile.name)}
              </span>
            ))}
        </div>
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
      </div>
    </Frame>
  );
}
