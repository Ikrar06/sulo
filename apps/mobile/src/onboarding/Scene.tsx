// A scene on the stage (M8c.2). Every scene is drawn on a design canvas as
// wide as the stage (so a full-width card lines up with the primary button,
// edge to edge, on every phone) and shown at scale 1 wherever the stage has room
// (360x800, 384x832): cards and banners are their real size and their text
// stays readable. Only a short screen or large text shrinks it, and never
// below 0.8: past that the scene switches to its compact canvas, which has
// fewer pieces (two cards instead of three), instead of shrinking further.
// The scene is centered both ways. Text inside a scene follows the phone's
// text size like every other text (the WebView zooms all of it), so pieces
// holding text take their height from it; it is hidden from screen readers
// (the stage carries one label).

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export const MIN_SCALE = 0.8;
/** Sent when a scene's canvas moves or scales: the flying mascot looks for its spot again (FlyingMascot.tsx). */
export const SCENE_MOVED = 'sulo:scene-moved';
/** Rounds per stage size in which a scene's overhang may also shrink (Scene below). */
const SETTLE_ROUNDS = 6;
/**
 * The stage's floor: below it the screen scrolls instead of the scene shrinking further. Large text on a short
 * screen leaves the scene almost no room; at 180 px the compact scene still shows a card and the mascot at about
 * half size, and the text above the button stays whole.
 */
const STAGE_MIN = 'min-h-[180px]';

/**
 * Which canvas fits and at what scale: the full one down to 0.8, else the
 * compact one. `width` is the canvas width in design px: the stage's width
 * at that scale, so the scene always spans the stage exactly.
 */
export function fitScene(stage: { width: number; height: number }, h: number, compactH: number): { compact: boolean; scale: number; width: number } {
  const full = Math.min(1, stage.height / h);
  const compact = full < MIN_SCALE;
  const scale = compact ? Math.min(1, stage.height / compactH) : full;
  return { compact, scale, width: Math.round(stage.width / scale) };
}

export function Scene({ label, h, compactH, children, hidden = false, top = false }: { label?: string; h: number; compactH: number; children: (compact: boolean, width: number) => ReactNode; hidden?: boolean; /** Under an empty top bar: the scene sits near the top of the stage instead of its middle, so no void opens above it. */ top?: boolean }) {
  const stage = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState<{ compact: boolean; scale: number; width: number; lift: number; over: number } | null>(null);
  // The fit changes the canvas width, the width changes how the pieces wrap, and that changes the overhang again. The
  // overhang follows the pieces for a few rounds per stage size; after that it only grows, so the loop always settles
  // instead of going round forever.
  const most = useRef({ stage: '', over: 0, rounds: 0 });
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      // How far the pieces reach above the canvas (large text makes a scene's pieces taller than drawn): the stage
      // fits the whole of it, so nothing is pushed out of the stage.
      const pieces = canvas.current ? [...canvas.current.querySelectorAll<HTMLElement>('[data-onb-piece]')] : [];
      const key = `${Math.round(r.width)}x${Math.round(r.height)}x${h}x${compactH}`;
      if (most.current.stage !== key) most.current = { stage: key, over: 0, rounds: 0 };
      const seen = Math.max(0, ...pieces.map((p) => -p.offsetTop));
      const settled = most.current.rounds >= SETTLE_ROUNDS;
      const over = settled ? Math.max(most.current.over, seen) : seen;
      if (Math.abs(over - most.current.over) >= 0.5) most.current.rounds += 1;
      most.current.over = over;
      const f = fitScene(r, h + over, compactH + over);
      // Free height above the scene when centered; `top` keeps at most 12 px of it.
      const free = (r.height - ((f.compact ? compactH : h) + over) * f.scale) / 2;
      const next = { ...f, lift: top ? Math.max(0, free - 12) : 0, over };
      setFit((p) => (p && p.compact === next.compact && Math.abs(p.scale - next.scale) < 0.002 && p.width === next.width && Math.abs(p.lift - next.lift) < 0.5 && Math.abs(p.over - next.over) < 0.5 ? p : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // The pieces move when a scene lays itself out again (their style changes): measured again then.
    const mo = new MutationObserver(measure);
    if (canvas.current) mo.observe(canvas.current, { subtree: true, attributes: true, attributeFilter: ['style', 'hidden'] });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [h, compactH, top]);
  // The canvas moved without the window changing (a scene laid itself out again): the mascot's spot moved with it.
  useEffect(() => {
    if (fit) window.dispatchEvent(new Event(SCENE_MOVED));
  }, [fit]);
  const compact = fit?.compact ?? false;
  // Pieces reaching `over` px above the canvas: the canvas moves down by half of that, so the whole scene is centered.
  const down = ((fit?.over ?? 0) / 2) * (fit?.scale ?? 1);
  const style = { width: fit?.width ?? 328, height: compact ? compactH : h, transform: `translate(-50%, calc(-50% - ${fit?.lift ?? 0}px + ${down}px)) scale(${fit?.scale ?? 1})`, visibility: fit === null ? 'hidden' : 'visible' } as CSSProperties;
  return (
    <div ref={stage} data-onb-stage="" data-onb-scale={fit?.scale.toFixed(3)} data-onb-compact={compact ? '' : undefined} role={label ? 'img' : undefined} aria-label={label} aria-hidden={hidden || !label ? true : undefined} className={`relative ${STAGE_MIN} flex-1`}>
      <div ref={canvas} data-onb-scene="" aria-hidden="true" inert className="absolute top-1/2 left-1/2 origin-center" style={style}>
        {children(compact, fit?.width ?? 328)}
      </div>
    </div>
  );
}

/** A piece of a scene at a fixed place on the canvas (design px). `data-onb-piece` is what the layout check measures. */
export function At({ x, y, w, h, children, className = '', z, pieceRef, hidden }: { x: number; y: number; w?: number; h?: number; children?: ReactNode; className?: string; z?: number; pieceRef?: React.Ref<HTMLDivElement>; /** Laid out (and measurable) but not part of the picture. */ hidden?: boolean }) {
  return (
    <div ref={pieceRef} data-onb-piece={hidden ? undefined : ''} className={`absolute ${className}`} style={{ left: x, top: y, width: w, height: h, zIndex: z, visibility: hidden ? 'hidden' : undefined }}>
      {children}
    </div>
  );
}
