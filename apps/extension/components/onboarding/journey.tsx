// The extension's onboarding frame (Tahap 2), after the phone's approved one.
// Content at most 1040 wide, centred. At 1024 and wider two columns 64 apart:
// the scene's stage (55 % of the width) on the left, the title, line and
// actions on the right, centred vertically on the scene; narrower, one
// column as on the phone. The top bar holds the small brand mark and "Sulo"
// on the left; on the right "Lewati" during the intro, and the progress bar
// only on the setup steps after it (as on the phone).
//
// One mascot for the whole journey: it sits at the step's slot
// (<MascotSlot>) and flies to the next one (FLIP, transform only). A scene
// is a stack of pieces at their real size and the mascot under it; pieces
// marked data-ob-optional show only while the stage has the height for them,
// so the scene always fills its stage without scaling anything.
//
// Motion: story motion slow and multiplied by SCENE_TEMPO (1.4), response
// motion quick; buttons work from the start, Next in the middle of a scene
// moves on at once. Two levels of scene: full, and simple (fewer moving
// parts) on a small machine; nothing moves under reduced motion.

import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { extOnboardingWords } from '@sulo/core/i18n/ext-onboarding';
import type { MascotState } from '@sulo/core/view/popup-view';
import { useI18n } from '@sulo/ui/i18n';
import { Mascot } from '@sulo/ui/mascot/Mascot';
import { Button } from '@sulo/ui/ui/button';
import { BrandMark } from '../BrandMark';

/** Story motion × this; the phone's approved default. */
export const SCENE_TEMPO = 1.4;
export const story = (ms: number) => Math.round(ms * SCENE_TEMPO);

export type SceneLevel = 'full' | 'simple' | 'still';
export function sceneLevel(): SceneLevel {
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return 'still';
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (nav.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4 ? 'simple' : 'full';
}

/** The big mascot under a scene: 184 up to an 860 px tall window (1280x800), 200 above (1440x900). */
export function useSceneMascotSize(): number {
  const [h, setH] = useState(() => (typeof window === 'undefined' ? 800 : window.innerHeight));
  useLayoutEffect(() => {
    const on = () => setH(window.innerHeight);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return h >= 860 ? 200 : 184;
}

interface MascotSpec {
  state: MascotState;
  celebrate?: number;
  look?: { x: number; y: number } | null;
}
const MascotContext = createContext<{ set: (m: MascotSpec) => void; slot: RefObject<HTMLDivElement | null> } | null>(null);

/** Where the journey's one mascot sits on this step, and its size. */
export function MascotSlot({ size, className = '' }: { size: number; className?: string }) {
  const ctx = useContext(MascotContext);
  return <div ref={ctx?.slot} data-mascot-slot="" aria-hidden="true" className={`shrink-0 ${className}`} style={{ width: size, height: size }} />;
}

/** The mascot's expression on this step (set by the step). */
export function useMascot(spec: MascotSpec) {
  const ctx = useContext(MascotContext);
  const key = JSON.stringify(spec);
  useLayoutEffect(() => ctx?.set(spec), [key]); // eslint-disable-line react-hooks/exhaustive-deps
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

export interface JourneyProps {
  stepKey: string;
  /** The setup steps after the intro: their bar on the top right. */
  progress?: { position: number; total: number };
  /** The intro: "Lewati" on the top right instead of a bar. */
  onSkip?: () => void;
  /** The stage (left column): the scene, from real components at their real size. */
  scene?: ReactNode;
  /** The scene holds controls (the course list): not hidden from screen readers. */
  sceneInteractive?: boolean;
  /** Title, line and actions (right column). */
  children: ReactNode;
  /** The one-line "not official" note, small at the bottom left, once per surface. */
  footnote?: ReactNode;
}

export function Journey({ stepKey, progress, onSkip, scene, sceneInteractive = false, children, footnote }: JourneyProps) {
  const { locale } = useI18n();
  const w = extOnboardingWords(locale).phone;
  const root = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const flyer = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLElement>(null);
  const [mascot, setMascot] = useState<MascotSpec>({ state: 'idle' });
  const [box, setBox] = useState<{ x: number; y: number; size: number } | null>(null);
  const last = useRef<{ key: string; x: number; y: number; size: number } | null>(null);

  // The scene fills its stage: optional pieces (data-ob-optional) go, last first, until the
  // scene fits; they come back when the window is taller. Nothing is scaled.
  useLayoutEffect(() => {
    const fit = () => {
      const scene = stage.current?.querySelector<HTMLElement>('.obj-scene:not(.obj-scene-list)');
      if (!scene || !stage.current) return;
      const optional = [...scene.querySelectorAll<HTMLElement>('[data-ob-optional]')];
      // The room is the window's (the stage grows with its content, so never its own height);
      // in one column (below 1024) the scene keeps only its required pieces.
      const twoColumns = window.innerWidth >= 1024;
      for (const o of optional) o.hidden = !twoColumns;
      if (!twoColumns) return;
      const room = window.innerHeight - 64 - 40 - 32;
      for (let i = optional.length - 1; i >= 0 && scene.getBoundingClientRect().height > room + 1; i--) optional[i]!.hidden = true;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [stepKey]);

  // Place the mascot on the slot; on a new step, fly from where it was (FLIP).
  useLayoutEffect(() => {
    const place = () => {
      const s = slot.current;
      const r = root.current;
      if (!s || !r) return setBox(null);
      const a = s.getBoundingClientRect();
      const b = r.getBoundingClientRect();
      setBox({ x: a.left - b.left, y: a.top - b.top, size: a.width });
    };
    place();
    const ro = new ResizeObserver(place);
    if (root.current) ro.observe(root.current);
    window.addEventListener('resize', place);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [stepKey]);

  useLayoutEffect(() => {
    if (!box || !flyer.current) return;
    const prev = last.current;
    last.current = { key: stepKey, ...box };
    if (!prev || prev.key === stepKey || sceneLevel() === 'still' || typeof flyer.current.animate !== 'function') return;
    const dx = prev.x - box.x;
    const dy = prev.y - box.y;
    const k = prev.size / box.size;
    flyer.current.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${k})` }, { transform: 'translate(0, 0) scale(1)' }], { duration: story(480), easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)' });
  }, [box, stepKey]);

  return (
    <MascotContext.Provider value={{ set: setMascot, slot }}>
      <div ref={root} className="obj relative">
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
        <main className={`obj-main ${scene ? '' : 'is-alone'}`}>
          {scene && (
            <section ref={stage} data-ob-stage="" className="obj-stage" aria-hidden={sceneInteractive ? undefined : true}>
              {scene}
            </section>
          )}
          <section key={stepKey} className="obj-text">
            {children}
          </section>
        </main>
        {footnote && <footer className="obj-foot">{footnote}</footer>}
        {box && (
          <div ref={flyer} data-onb-mascot="" className="pointer-events-none absolute top-0 left-0 origin-top-left" style={{ translate: `${box.x}px ${box.y}px`, width: box.size, height: box.size }}>
            <Mascot state={mascot.state} size={box.size} celebrate={mascot.celebrate ?? 0} look={mascot.look ?? null} />
          </div>
        )}
      </div>
    </MascotContext.Provider>
  );
}

/** Title 32/38 bold and its one line 16/24 muted, at most 360 wide. */
export const JTitle = ({ children, id }: { children: ReactNode; id?: string }) => (
  <h1 id={id} tabIndex={-1} className="max-w-[360px] font-heading text-[32px] leading-[38px] font-bold text-balance outline-none">
    {children}
  </h1>
);
export const JLine = ({ children }: { children: ReactNode }) => <p className="mt-3 max-w-[360px] text-[16px] leading-6 text-muted-foreground">{children}</p>;
/** The actions, 28 below the line; the primary one a 44 pill at least 180 wide. */
export const JActions = ({ children }: { children: ReactNode }) => <div className="obj-actions mt-7 flex flex-wrap items-center gap-3">{children}</div>;
