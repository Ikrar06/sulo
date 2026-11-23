// The extension's onboarding frame (Tahap 2, second layout). Content at most
// 1040 wide, centred. At 1024 and wider two columns 72 apart with fixed roles:
//   left  = the scene only, as tall as its content, centred vertically
//   right = the mascot, then the title, line, actions and the status or dots,
//           left aligned, centred on the same axis as the scene
// Narrower, one column: mascot 120, title, line, the scene (at most three
// pieces), actions. The top bar holds the small brand mark and "Sulo" on the
// left; "Lewati" during the intro, the progress bar on the setup steps.
//
// One mascot for the whole journey, always at the same place and size (its
// box does not depend on the step: the right column's top is fixed from the
// content area's height, not from the text below the mascot). Only its
// expression changes. It glances left at the scene while the scene moves,
// then looks ahead again.
//
// Step change: only the scene and the text block change (out: 16 px and a
// fade in 160 ms; in: 240 ms); transform and opacity only. Reduced motion:
// the scene shows in its final arrangement and the blocks fade in 120 ms.

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { extOnboardingWords } from '@sulo/core/i18n/ext-onboarding';
import { moodFor } from '@sulo/core/dashboard/mascot-mood';
import type { MascotState } from '@sulo/core/view/popup-view';
import { useI18n } from '@sulo/ui/i18n';
import { ChevronLeftIcon } from '@sulo/ui/icons';
import { SuloMascot } from '@sulo/ui/mascot/SuloMascot';
import { Button } from '@sulo/ui/ui/button';
import { BrandMark } from '../BrandMark';

/** Story motion × this; the phone's approved default. */
export const SCENE_TEMPO = 1.4;
export const story = (ms: number) => Math.round(ms * SCENE_TEMPO);
/** The old step's blocks leave in this long, before the new ones come in. */
const OUT_MS = 160;

export type SceneLevel = 'full' | 'simple' | 'still';
export function sceneLevel(): SceneLevel {
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return 'still';
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (nav.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4 ? 'simple' : 'full';
}

/** The window's size, kept current. */
export function useViewport(): { w: number; h: number } {
  const read = () => (typeof window === 'undefined' ? { w: 1280, h: 800 } : { w: window.innerWidth, h: window.innerHeight });
  const [v, setV] = useState(read);
  useLayoutEffect(() => {
    const on = () => setV(read());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return v;
}

/** Two columns from this width. */
export const TWO_COLUMNS = 1024;
/** A window this tall (1440x900) has room for the larger mascot and one more scene piece. */
export const TALL = 860;

/** The journey's mascot: 144 up to an 860 px tall window (1280x800), 160 above (1440x900), 120 in one column. */
export function mascotSize(v: { w: number; h: number }): number {
  if (v.w < TWO_COLUMNS) return 120;
  return v.h >= TALL ? 160 : 144;
}

/** The scene has room for its larger arrangement (four task cards): two columns and a tall window. */
export const useRoomy = () => {
  const v = useViewport();
  return v.w >= TWO_COLUMNS && v.h >= TALL;
};
/** One column: a scene shows at most three pieces. */
export const useNarrow = () => useViewport().w < TWO_COLUMNS;

export interface MascotSpec {
  state: MascotState;
  celebrate?: number;
  /** Where it looks at first (default: left, at the scene), for `lookMs`; then ahead. null looks ahead from the start. */
  look?: { x: number; y: number } | null;
  /** How long the first look lasts (default: the scene's arrival). */
  lookMs?: number;
  /** The expression after the first look (default: `state`). */
  then?: MascotState;
  /** Changes to play the first look again (the same row clicked twice). */
  at?: number;
}
const MascotContext = createContext<((m: MascotSpec) => void) | null>(null);

/** The mascot's expression on this step (set by the step's text block). */
export function useMascot(spec: MascotSpec) {
  const set = useContext(MascotContext);
  const key = JSON.stringify(spec);
  useLayoutEffect(() => set?.(spec), [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** The setup steps' bar (after the intro): one segment per step, the current one longer. */
function Progress({ position, total }: { position: number; total: number }) {
  const { m } = useI18n();
  return (
    <div role="img" aria-label={m.onboarding.stepLabel(position, total)} className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-1.5 rounded-full ${i + 1 === position ? 'w-8 bg-foreground' : i + 1 < position ? 'w-4 bg-foreground/60' : 'w-4 bg-foreground/20'}`} />
      ))}
    </div>
  );
}

/** The mascot's look and expression over time: the spec's first look, then ahead. */
function useMascotTimeline(spec: MascotSpec): { state: MascotState; look: { x: number; y: number } | null } {
  const [phase, setPhase] = useState<'first' | 'after'>('first');
  const key = JSON.stringify(spec);
  useEffect(() => {
    setPhase('first');
    if (sceneLevel() === 'still') return setPhase('after');
    const t = window.setTimeout(() => setPhase('after'), spec.lookMs ?? story(900));
    return () => window.clearTimeout(t);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (phase === 'first') return { state: spec.state, look: spec.look === undefined ? { x: -1, y: 0 } : spec.look };
  return { state: spec.then ?? spec.state, look: null };
}

export interface JourneyProps {
  stepKey: string;
  /** The setup steps after the intro: their bar on the top right. */
  progress?: { position: number; total: number };
  /** The intro: "Lewati" on the top right instead of a bar. */
  onSkip?: () => void;
  /** The left column: the scene, from real components at their real size. */
  scene?: ReactNode;
  /** The scene holds controls (the course list): not hidden from screen readers. */
  sceneInteractive?: boolean;
  /** The text block (right column): JTitle, JLine, JActions, then JAfter. */
  children: ReactNode;
  /** The one-line "not official" note, small at the bottom left, once per surface. */
  footnote?: ReactNode;
}

interface Shown {
  key: string;
  scene: ReactNode;
  children: ReactNode;
  interactive: boolean;
}

export function Journey({ stepKey, progress, onSkip, scene, sceneInteractive = false, children, footnote }: JourneyProps) {
  const { locale } = useI18n();
  const w = extOnboardingWords(locale).phone;
  const v = useViewport();
  const size = mascotSize(v);
  const [spec, setSpec] = useState<MascotSpec>({ state: 'idle' });
  const mascot = useMascotTimeline(spec);
  // The step that is leaving (shown for OUT_MS), then the live one.
  const [leaving, setLeaving] = useState<Shown | null>(null);
  const last = useRef<Shown>({ key: stepKey, scene, children, interactive: sceneInteractive });
  useLayoutEffect(() => {
    const prev = last.current;
    if (prev.key === stepKey || sceneLevel() === 'still') return;
    setLeaving(prev);
    const t = window.setTimeout(() => setLeaving(null), OUT_MS);
    return () => window.clearTimeout(t);
  }, [stepKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    last.current = { key: stepKey, scene, children, interactive: sceneInteractive };
  });
  // The new step's title takes the focus once it is in (a ring only for keyboards).
  useEffect(() => {
    if (leaving) return;
    document.getElementById('ob-title')?.focus({ preventScroll: true });
  }, [leaving, stepKey]);

  const shown: Shown = leaving ?? { key: stepKey, scene, children, interactive: sceneInteractive };
  const swap = leaving ? 'obj-out' : 'obj-enter';
  return (
    <MascotContext.Provider value={setSpec}>
      <div className="obj" style={{ ['--obj-mascot' as string]: `${size}px` }}>
        <header className="obj-top">
          <span className="flex items-center gap-2">
            <BrandMark size={20} />
            <span className="font-heading text-[16px]">Sulo</span>
          </span>
          {onSkip ? (
            <Button variant="ghost" onClick={onSkip}>
              {w.skip}
            </Button>
          ) : (
            progress && <Progress position={progress.position} total={progress.total} />
          )}
        </header>
        <main className={`obj-main ${shown.scene ? '' : 'is-alone'}`}>
          {shown.scene && (
            <section data-ob-stage="" className="obj-stage" aria-hidden={shown.interactive ? undefined : true}>
              <div key={shown.key} className={`obj-swap ${swap}`}>
                {shown.scene}
              </div>
            </section>
          )}
          <section className="obj-side">
            <div data-onb-mascot="" className="obj-mascot" aria-hidden="true">
              <SuloMascot mood={moodFor(mascot.state)} size={size} reaction={spec.celebrate ? { name: 'celebrate', key: spec.celebrate } : null} lookX={mascot.look?.x} lookY={mascot.look?.y} followCursor />
            </div>
            <div key={shown.key} className={`obj-text ${swap}`}>
              {shown.children}
            </div>
          </section>
        </main>
        {footnote && <footer className="obj-foot">{footnote}</footer>}
      </div>
    </MascotContext.Provider>
  );
}

/** Title 32/38 bold, at most two lines, 24 under the mascot. */
export const JTitle = ({ children, id }: { children: ReactNode; id?: string }) => (
  <h1 id={id} tabIndex={-1} className="obj-head max-w-[380px] font-heading text-[32px] leading-[38px] font-bold text-balance outline-none">
    {children}
  </h1>
);
/** The supporting line 16/24 muted, 12 under the title, at most 380 wide. */
export const JLine = ({ children }: { children: ReactNode }) => <p className="obj-head obj-line mt-3 max-w-[380px] text-[16px] leading-6 text-muted-foreground">{children}</p>;
/** The actions, 28 below the line: the back circle (if any), then the primary pill (44 tall, at least 180 wide). */
export const JActions = ({ children }: { children: ReactNode }) => <div className="obj-actions mt-7 flex flex-wrap items-center gap-3">{children}</div>;
/** A secondary text link, 16 under the actions. */
export const JLink = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
  <div className="obj-after mt-4">
    <button type="button" onClick={onClick} className="rounded-sm text-[14px] font-medium underline underline-offset-4 outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-focus">
      {children}
    </button>
  </div>
);
/** The dots (intro) or the status line (other steps), 20 under what is above. */
export const JAfter = ({ children }: { children: ReactNode }) => <div className="obj-after obj-status mt-5">{children}</div>;

/** The back button: a 44 circle on the inset layer. */
export function BackCircle({ onClick }: { onClick: () => void }) {
  const { locale } = useI18n();
  return (
    <button type="button" aria-label={extOnboardingWords(locale).phone.back} onClick={onClick} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-ring:ring-2 focus-ring:ring-focus" style={{ background: 'var(--layer-inset)' }}>
      <ChevronLeftIcon className="size-5" />
    </button>
  );
}

/** A status line: a small indicator (busy, waiting, ok, problem), then its words. */
export function JStatus({ tone, children }: { tone: 'busy' | 'wait' | 'ok' | 'problem'; children: ReactNode }) {
  const color = tone === 'ok' ? 'var(--foreground)' : tone === 'problem' ? 'var(--urgency-overdue)' : 'var(--muted-foreground)';
  return (
    <p role="status" className="flex items-center gap-2 text-[14px] leading-5 text-muted-foreground">
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${tone === 'busy' ? 'obj-pulse' : ''}`} style={{ background: color, opacity: tone === 'wait' ? 0.5 : 1 }} />
      {children}
    </p>
  );
}
