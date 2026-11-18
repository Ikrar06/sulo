// Screens 0-3 (M8c.2): the splash and the three intro screens. No request
// leaves the phone here. Each stage is one short entrance; the only thing
// that repeats is the mascot's own idle.

import { useEffect, useRef, useState } from 'react';
import type { OnboardingWords } from '@sulo/core/i18n/mobile-onboarding';
import { EyeOffIcon, ShieldIcon } from '@sulo/ui/dashboard-icons';
import { BellIcon, KeyIcon } from '@sulo/ui/icons';
import { Card, IconTile } from '@sulo/ui/mobile/cards';
import { ProgressRing } from '@sulo/ui/mobile/ring';
import { MascotSpot, useMascotCue } from './FlyingMascot';
import { draw, EASE_OUT, EASE_SPRING, enter, MS, staggerDelays } from './motion';
import { IntroLayout } from './Shell';
import { Connector, DemoTask, Piece, useAfter, useCountUp } from './Stage';

export interface IntroNav {
  w: OnboardingWords;
  unofficial: string;
  next: () => void;
  back: (() => void) | null;
  skip: () => void;
}

/** Screen 0: an accent dot grows into the mascot, the name and the line come in; 1.6 s or a tap moves on. */
export function Splash({ w, next }: Pick<IntroNav, 'w' | 'next'>) {
  const name = useRef<HTMLParagraphElement | null>(null);
  const line = useRef<HTMLParagraphElement | null>(null);
  const dot = useRef<HTMLSpanElement | null>(null);
  useMascotCue({ state: 'onboarding' });
  useEffect(() => {
    dot.current?.animate([{ opacity: 0 }, { opacity: 1, offset: 0.4 }, { opacity: 0 }], { duration: 420, easing: EASE_OUT, fill: 'forwards' });
    const a = enter(name.current, { y: 8 }, { delay: 380, duration: 240 });
    const b = enter(line.current, { y: 8 }, { delay: 460, duration: 240 });
    return () => {
      a?.cancel();
      b?.cancel();
    };
  }, []);
  useAfter(1600, next, true);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center" onClick={next}>
      <div className="relative">
        <MascotSpot size={120} />
        <span ref={dot} aria-hidden="true" className="absolute top-1/2 left-1/2 -mt-1 -ml-1 size-2 rounded-full bg-primary opacity-0" />
      </div>
      <p ref={name} className="mt-4 text-m26">
        {w.splash.name}
      </p>
      <p ref={line} className="mt-1 text-m13 text-muted-foreground">
        {w.splash.tagline}
      </p>
    </main>
  );
}

const TASK_RESTS = [
  { left: 14, top: 24, width: 80, rotate: -3, scale: 0.9 },
  { left: 5, top: 43, width: 80, rotate: 2.5, scale: 0.88 },
  { left: 15, top: 62, width: 80, rotate: -1.5, scale: 0.86 },
] as const;

/** Screen 1: three task cards rise in order and stack; the line draws; the top card ticks itself once. */
export function Intro1({ w, next, skip }: IntroNav) {
  const t = w.intro1;
  const [mood, setMood] = useState<'onboarding' | 'urgent' | 'all-done'>('onboarding');
  const [done, setDone] = useState(false);
  const delays = staggerDelays(3, 120, 90);
  useMascotCue({ state: mood });
  // A moment of worry while the late card lands, then calm.
  useAfter(delays[0]! + 120, () => setMood('urgent'));
  useAfter(delays[0]! + 620, () => setMood('onboarding'));
  // After everything is in: the demo tick, the strike-through, 800 ms of joy.
  useAfter(1300, () => {
    setDone(true);
    setMood('all-done');
  });
  useAfter(2100, () => setMood('onboarding'));
  return (
    <IntroLayout
      stepKey="intro1"
      title={t.title}
      body={t.body}
      stageLabel={t.stage}
      dots={{ index: 0, count: 3, label: w.pageOf(1, 3) }}
      action={{ label: w.next, onPress: next }}
      skip={{ label: w.skip, onPress: skip }}
      onSwipeNext={next}
      stage={
        <>
          <Connector points={[[52, 32], [44, 52], [56, 74]]} delay={delays[2]! + 200} />
          {t.cards.map((c, i) => (
            <Piece key={c.title} rest={TASK_RESTS[i]!} from={{ y: 40 }} delay={delays[i]!} duration={MS.enter} z={3 - i}>
              <DemoTask course={c.course} color={[1, 4, 6][i]!} title={c.title} due={c.due} tone={c.tone} done={i === 0 && done} />
            </Piece>
          ))}
          <div className="absolute top-[6%] left-0">
            <MascotSpot size={72} />
          </div>
        </>
      }
    />
  );
}

/** Screen 2: a reminder drops in with a small bounce; the exam countdown and the attendance ring fill. */
export function Intro2({ w, next, back, skip }: IntroNav) {
  const t = w.intro2;
  const [hop, setHop] = useState(0);
  const days = useCountUp(12, 500, 520);
  const ring = useCountUp(90, 600, 620);
  useMascotCue({ state: 'all-done', poke: hop });
  return (
    <IntroLayout
      stepKey="intro2"
      title={t.title}
      body={t.body}
      stageLabel={t.stage}
      dots={{ index: 1, count: 3, label: w.pageOf(2, 3) }}
      action={{ label: w.next, onPress: next }}
      skip={{ label: w.skip, onPress: skip }}
      onSwipeNext={next}
      onSwipeBack={back}
      stage={
        <>
          <Piece rest={{ left: 4, top: 24, width: 74, rotate: -2, scale: 0.92 }} from={{ y: -48 }} delay={120} duration={MS.enterLong} easing={EASE_SPRING} z={3} onIn={() => setHop((n) => n + 1)}>
            <Card dense>
              <div className="flex items-center gap-3">
                <IconTile color="accent" icon={BellIcon} />
                <div className="min-w-0">
                  <p className="truncate text-m15">{t.notifyTitle}</p>
                  <p className="truncate text-m13 text-muted-foreground">{t.notifyBody}</p>
                </div>
              </div>
            </Card>
          </Piece>
          <Piece rest={{ left: 8, top: 52, width: 46, rotate: 3, scale: 0.88 }} from={{ y: 32 }} delay={420} z={2}>
            <Card dense>
              <p className="text-m12 text-muted-foreground">{t.calendarLabel}</p>
              <p className="mt-1 text-m22 text-urgency-soon tabular-nums">{days}</p>
              <p className="text-m12 text-muted-foreground">{t.calendarUnit}</p>
            </Card>
          </Piece>
          <Piece rest={{ left: 50, top: 58, width: 44, rotate: -4, scale: 0.86 }} from={{ y: 32 }} delay={500} z={1}>
            <Card dense>
              <div className="flex items-center gap-2">
                <ProgressRing value={ring} size={44} stroke={5} label={`${ring}%`} />
                <div className="min-w-0">
                  <p className="text-m12 text-muted-foreground">{t.attendanceLabel}</p>
                  <p className="text-m15 tabular-nums">{ring}%</p>
                </div>
              </div>
            </Card>
          </Piece>
          <Connector points={[[40, 40], [32, 56], [70, 62]]} delay={760} />
          <div className="absolute top-[6%] right-0">
            <MascotSpot size={72} />
          </div>
        </>
      }
    />
  );
}

const POINT_ICONS = [KeyIcon, ShieldIcon, EyeOffIcon];

/** Screen 3: three promises, each ending with a drawn check; the mascot nods at every check. */
export function Intro3({ w, unofficial, next, back }: IntroNav) {
  const t = w.intro3;
  const [nod, setNod] = useState(0);
  const delays = staggerDelays(3, 160, 220, 700);
  useMascotCue({ state: 'onboarding', poke: nod });
  return (
    <IntroLayout
      stepKey="intro3"
      title={t.title}
      stageLabel={t.stage}
      dots={{ index: 2, count: 3, label: w.pageOf(3, 3) }}
      action={{ label: w.start, onPress: next }}
      onSwipeNext={next}
      onSwipeBack={back}
      footer={<p className="text-center text-m12 text-muted-foreground">{unofficial}</p>}
      stage={
        <div className="flex h-full flex-col items-center justify-center">
          <MascotSpot size={72} />
          <ul className="mt-3 w-full space-y-2">
            {t.points.map((p, i) => (
              <Point key={p} text={p} icon={POINT_ICONS[i]!} delay={delays[i]!} onChecked={() => setNod((n) => n + 1)} />
            ))}
          </ul>
        </div>
      }
    />
  );
}

function Point({ text, icon, delay, onChecked }: { text: string; icon: typeof KeyIcon; delay: number; onChecked: () => void }) {
  const row = useRef<HTMLLIElement | null>(null);
  const check = useRef<SVGPathElement | null>(null);
  const cb = useRef(onChecked);
  cb.current = onChecked;
  useEffect(() => {
    const a = enter(row.current, { y: 16 }, { delay });
    // The check draws itself once the row has settled.
    const b = draw(check.current, { delay: delay + 240, duration: 260 });
    if (b) b.onfinish = () => cb.current();
    return () => {
      a?.cancel();
      b?.cancel();
    };
  }, [delay]);
  return (
    <li ref={row}>
      <Card dense>
        <div className="flex items-center gap-3">
          <IconTile color="neutral" icon={icon} />
          <p className="min-w-0 flex-1 text-m15r">{text}</p>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path ref={check} d="M5 12.5 10 17 19 7.5" />
          </svg>
        </div>
      </Card>
    </li>
  );
}
