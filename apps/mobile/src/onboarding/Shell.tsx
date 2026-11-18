// Onboarding layouts (M8c.2). Intro screens: a top row with "Lewati" on the
// right, the stage (about 52 % of the height, 44 % below 700 px), then the
// title 26, one 15 px line, the page dots and the full-width pill, all
// within thumb reach. Setup screens: the three-segment progress bar with the
// small mascot spot beside it, the content, then a round back button and the
// pill, with "Lewati langkah ini" under them when the step is optional.
// The title is focused first on every screen (TalkBack reads title, body,
// buttons in order).

import { useEffect, useRef, type ReactNode, type TouchEvent } from 'react';
import { ChevronLeftIcon } from '@sulo/ui/icons';
import { PillButton } from '@sulo/ui/mobile/controls';
import { MascotSpot } from './FlyingMascot';
import { MS } from './motion';

/** Clear of the gesture bar; textZoom grows text, never under the buttons (the column scrolls). */
const column = 'mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[calc(8px+env(safe-area-inset-top))] pb-[calc(24px+env(safe-area-inset-bottom))]'; // lint-ui-allow: 24 over the gesture bar

/** Focus the screen's title first, without scrolling or showing a keyboard ring. */
export function useTitleFocus(key: string) {
  const ref = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => ref.current?.focus({ preventScroll: true }), [key]);
  return ref;
}

/** A horizontal swipe on the intro: left goes on, right goes back. */
function useSwipe(onNext: () => void, onBack: (() => void) | null) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: TouchEvent) => (start.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY }),
    onTouchEnd: (e: TouchEvent) => {
      const s = start.current;
      start.current = null;
      const t = e.changedTouches[0];
      if (!s || !t) return;
      const dx = t.clientX - s.x;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(t.clientY - s.y) * 1.5) return;
      if (dx < 0) onNext();
      else onBack?.();
    },
  };
}

export function Dots({ index, count, label }: { index: number; count: number; label: string }) {
  return (
    <div role="img" aria-label={label} className="flex items-center justify-center gap-1.5">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`h-1.5 rounded-full transition-[width,background-color] ease-out motion-reduce:transition-none ${i === index ? 'w-4 bg-foreground' : 'w-1.5 bg-m-line'}`} style={{ transitionDuration: `${MS.dots}ms` }} />
      ))}
    </div>
  );
}

export function ProgressBar({ index, total, label }: { index: number; total: number; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={1} aria-valuemax={total} aria-valuenow={index + 1} className="flex flex-1 gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-200 motion-reduce:transition-none ${i <= index ? 'bg-foreground' : 'bg-m-line'}`} />
      ))}
    </div>
  );
}

export interface IntroProps {
  stepKey: string;
  title: string;
  body?: string;
  stage: ReactNode;
  stageLabel: string;
  dots?: { index: number; count: number; label: string };
  action: { label: string; onPress: () => void; disabled?: boolean };
  skip?: { label: string; onPress: () => void };
  /** Under the action (a link or the disclaimer). */
  footer?: ReactNode;
  onSwipeNext?: () => void;
  onSwipeBack?: (() => void) | null;
}

export function IntroLayout({ stepKey, title, body, stage, stageLabel, dots, action, skip, footer, onSwipeNext, onSwipeBack = null }: IntroProps) {
  const titleRef = useTitleFocus(stepKey);
  const swipe = useSwipe(onSwipeNext ?? (() => undefined), onSwipeBack);
  return (
    <main className={column} {...(onSwipeNext ? swipe : {})}>
      <div className="flex h-11 items-center justify-end">
        {skip && (
          <button type="button" onClick={skip.onPress} className="m-hit rounded-full px-2 text-m13 text-muted-foreground outline-none focus-ring:ring-2 focus-ring:ring-focus">
            {skip.label}
          </button>
        )}
      </div>
      {/* The stage: one description for screen readers, its parts hidden. */}
      <section role="img" aria-label={stageLabel} className="m-stage relative">
        <div aria-hidden="true" inert className="absolute inset-0">
          {stage}
        </div>
      </section>
      <div className="mt-auto flex flex-col items-center pt-6 text-center">
        <h1 ref={titleRef} tabIndex={-1} className="m-text-balance max-w-[20ch] text-m26 outline-none">
          {title}
        </h1>
        {body && <p className="mt-2 line-clamp-3 max-w-[34ch] text-m15 text-muted-foreground">{body}</p>}
        {dots && (
          <div className="mt-5">
            <Dots {...dots} />
          </div>
        )}
      </div>
      <div className="mt-5 flex flex-col gap-3">
        <PillButton kind="primary" full disabled={action.disabled} onPress={action.onPress}>
          {action.label}
        </PillButton>
        {footer}
      </div>
    </main>
  );
}

export interface SetupProps {
  stepKey: string;
  progress: { index: number; total: number; label: string } | null;
  title: string;
  body?: string;
  children: ReactNode;
  back?: { label: string; onPress: () => void } | null;
  action: { label: string; onPress: () => void; disabled?: boolean; help?: string };
  skip?: { label: string; onPress: () => void } | null;
  /** The small mascot beside the bar (none when the screen has its own spot). */
  barMascot?: boolean;
}

export function SetupLayout({ stepKey, progress, title, body, children, back, action, skip, barMascot = true }: SetupProps) {
  const titleRef = useTitleFocus(stepKey);
  return (
    <main className={column}>
      <div className="flex h-11 items-center gap-3">
        {progress && <ProgressBar {...progress} />}
        {barMascot && <MascotSpot size={40} />}
      </div>
      <h1 ref={titleRef} tabIndex={-1} className="m-text-balance mt-4 text-m22 outline-none">
        {title}
      </h1>
      {body && <p className="mt-1 text-m13 text-muted-foreground">{body}</p>}
      <div className="mt-5 flex min-h-0 flex-1 flex-col">{children}</div>
      <div className="mt-5 flex items-center gap-3">
        {back && (
          <button type="button" aria-label={back.label} onClick={back.onPress} className="m-hit m-press inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-m-inset outline-none focus-ring:ring-2 focus-ring:ring-focus">
            <ChevronLeftIcon aria-hidden="true" className="size-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <PillButton kind="primary" full disabled={action.disabled} onPress={action.onPress}>
            {action.label}
          </PillButton>
        </div>
      </div>
      {action.disabled && action.help && (
        <p role="status" className="mt-2 text-center text-m12 text-muted-foreground">
          {action.help}
        </p>
      )}
      {skip && (
        <button type="button" onClick={skip.onPress} className="m-hit mx-auto mt-2 rounded-full px-3 text-m13 text-muted-foreground outline-none focus-ring:ring-2 focus-ring:ring-focus">
          {skip.label}
        </button>
      )}
    </main>
  );
}
