// The onboarding frame (M8c.2): four zones, top to bottom, on every screen.
//   1. top bar, 48: back and progress, or "Lewati"; empty but still 48
//   2. the screen's own area, which takes all the height left (the stage)
//   3. (inside it) the text block
//   4. the action block, glued to the bottom: a 20 px hint line, the 52 px
//      primary pill, a 44 px slot for the secondary action; 16 px plus the
//      safe area under it
// The action block always keeps all three rows, so the primary button sits
// at exactly the same place on every screen and the thumb never moves.
// `data-onb-chrome` marks what stays put during a step change; only
// `data-onb-content` slides (StepSwap).

import { useEffect, useRef, type ReactNode } from 'react';
import { ChevronLeftIcon } from '@sulo/ui/icons';

export interface FrameAction {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function BackButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button type="button" aria-label={label} onClick={onPress} className="m-hit onb-press inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-m-inset outline-none focus-ring:ring-2 focus-ring:ring-focus">
      <ChevronLeftIcon aria-hidden="true" className="size-5" />
    </button>
  );
}

export function TextLink({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  return (
    <button type="button" onClick={onPress} className="m-hit rounded-full px-3 text-m13 text-muted-foreground underline underline-offset-4 outline-none focus-ring:ring-2 focus-ring:ring-focus">
      {children}
    </button>
  );
}

export function ProgressBar({ index, total, label }: { index: number; total: number; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={1} aria-valuemax={total} aria-valuenow={index + 1} className="flex min-w-0 flex-1 gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-m-line">
          <span className={`onb-seg block h-full w-full rounded-full bg-foreground ${i <= index ? 'is-on' : ''}`} />
        </span>
      ))}
    </div>
  );
}

export interface FrameProps {
  /** Left and right of the top bar (48 high either way). */
  topLeft?: ReactNode;
  topRight?: ReactNode;
  children: ReactNode;
  /** The 20 px line above the primary button ("4 dipilih", page dots). */
  hint?: ReactNode;
  primary?: FrameAction | null;
  /** Instead of the primary button, in its 52 px place (the preparing screen's progress). */
  primarySlot?: ReactNode;
  /** The 44 px slot under the primary button: a text button, a note, or both. */
  secondary?: ReactNode;
}

export function Frame({ topLeft, topRight, children, hint, primary, primarySlot, secondary }: FrameProps) {
  return (
    <div className="onb-frame mx-auto flex h-dvh w-full max-w-md flex-col px-4 pt-[env(safe-area-inset-top)]">
      <div data-onb-chrome="" className="flex h-12 shrink-0 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">{topLeft}</div>
        {topRight}
      </div>
      <div data-onb-content="" className="flex min-h-0 flex-1 flex-col">
        {children}
      </div>
      <div data-onb-chrome="" className="shrink-0 pb-[calc(16px+env(safe-area-inset-bottom))]">
        {/* At least 20 px; taller content (the intro's dots with their 20 px above and below) grows upward, never moving the button. */}
        <div className="flex min-h-5 items-center justify-center text-m12 text-muted-foreground">{hint}</div>
        {primary ? (
          <button
            type="button"
            disabled={primary.disabled}
            onClick={primary.onPress}
            className="m-hit onb-press flex h-13 w-full items-center justify-center rounded-full bg-primary text-m15 font-semibold text-primary-foreground outline-none focus-ring:ring-2 focus-ring:ring-focus disabled:opacity-40"
          >
            {primary.label}
          </button>
        ) : (
          <div className="flex h-13 items-center">{primarySlot}</div>
        )}
        <div className="flex h-11 flex-col items-center justify-center text-center">{secondary}</div>
      </div>
    </div>
  );
}

/** The centered text block of the intro, sign-in, preparing and done screens: a title and at most one supporting line. */
export function TextBlock({ title, body, titleRef, children }: { title: string; body?: string; titleRef?: React.Ref<HTMLHeadingElement>; children?: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col items-center pt-3 pb-2 text-center">
      <h1 ref={titleRef} tabIndex={-1} className="onb-title outline-none">
        {title}
      </h1>
      {body && <p className="mt-1.5 text-m15r text-muted-foreground">{body}</p>}
      {children}
    </div>
  );
}

/** Focus the screen's title first (TalkBack reads title, body, buttons), without scrolling. */
export function useTitleFocus(key: string) {
  const ref = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => ref.current?.focus({ preventScroll: true }), [key]);
  return ref;
}
