// A scene on the stage (M8c.2). Every scene is drawn on a design canvas as
// wide as the stage (so a full-width card lines up with the primary button,
// edge to edge, on every phone) and shown at scale 1 wherever the stage has room
// (360x800, 384x832): cards and banners are their real size and their text
// stays readable. Only a short screen or large text shrinks it, and never
// below 0.8: past that the scene switches to its compact canvas, which has
// fewer pieces (two cards instead of three), instead of shrinking further.
// The scene is centered both ways. Text inside a scene is part of the
// picture: it ignores the system text zoom and is hidden from screen
// readers (the stage carries one label).

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export const MIN_SCALE = 0.8;

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
  const [fit, setFit] = useState<{ compact: boolean; scale: number; width: number; lift: number } | null>(null);
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const f = fitScene(r, h, compactH);
      // Free height above the scene when centered; `top` keeps at most 12 px of it.
      const free = (r.height - (f.compact ? compactH : h) * f.scale) / 2;
      const next = { ...f, lift: top ? Math.max(0, free - 12) : 0 };
      setFit((p) => (p && p.compact === next.compact && Math.abs(p.scale - next.scale) < 0.002 && p.width === next.width && Math.abs(p.lift - next.lift) < 0.5 ? p : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [h, compactH, top]);
  const compact = fit?.compact ?? false;
  const style = { width: fit?.width ?? 328, height: compact ? compactH : h, transform: `translate(-50%, calc(-50% - ${fit?.lift ?? 0}px)) scale(${fit?.scale ?? 1})`, visibility: fit === null ? 'hidden' : 'visible', '--m-tz': 1 } as CSSProperties;
  return (
    <div ref={stage} data-onb-stage="" data-onb-scale={fit?.scale.toFixed(3)} data-onb-compact={compact ? '' : undefined} role={label ? 'img' : undefined} aria-label={label} aria-hidden={hidden || !label ? true : undefined} className="relative min-h-0 flex-1">
      <div data-onb-scene="" aria-hidden="true" inert className="absolute top-1/2 left-1/2 origin-center" style={style}>
        {children(compact, fit?.width ?? 328)}
      </div>
    </div>
  );
}

/** A piece of a scene at a fixed place on the canvas (design px). `data-onb-piece` is what the layout check measures. */
export function At({ x, y, w, h, children, className = '', z, pieceRef }: { x: number; y: number; w?: number; h?: number; children?: ReactNode; className?: string; z?: number; pieceRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={pieceRef} data-onb-piece="" className={`absolute ${className}`} style={{ left: x, top: y, width: w, height: h, zIndex: z }}>
      {children}
    </div>
  );
}
