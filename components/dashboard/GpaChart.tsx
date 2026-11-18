// IPS per semester (Nilai page, M7.1): a plain line with dots, drawn with SVG
// here (no chart library), as wide as its card in real pixels. The y axis
// adapts (lib/grades/axis.ts) so small changes near 4.00 show; when it does
// not start at 0, a small break mark and a note say so. With grades hidden
// or privacy mode on, the line stays but every number is left out.

import { useEffect, useId, useRef, useState } from 'react';
import { yAxisRange } from '@/lib/grades/axis';

export interface GpaPoint {
  label: string;
  ips: number;
  sks: number;
  /** Text for the tooltip and screen readers. */
  text: string;
}

const DEFAULT_W = 640;
const H = 220;
/** Room for the y labels on the left, the end labels on both sides, value labels above. */
const PAD = { left: 56, right: 48, top: 24, bottom: 32 };

export function GpaChart({ points, title, hideValues, note }: { points: readonly GpaPoint[]; title: string; hideValues: boolean; note: (min: string) => string }) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const [W, setW] = useState(DEFAULT_W);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setW(Math.max(280, Math.round(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const axis = yAxisRange(points.map((p) => p.ips));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  // The first and last dots keep clear of the y labels and the card's edge.
  const INSET = 28;
  const span = innerW - 2 * INSET;
  const x = (i: number) => PAD.left + INSET + (points.length === 1 ? span / 2 : (i / (points.length - 1)) * span);
  const y = (v: number) => PAD.top + (1 - (Math.max(axis.min, Math.min(axis.max, v)) - axis.min) / (axis.max - axis.min)) * innerH;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.ips).toFixed(1)}`).join(' ');
  const shown = active === null || hideValues ? null : points[active];
  const bottom = PAD.top + innerH;
  return (
    <div ref={box} className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-labelledby={`${id}-t`}>
        <title id={`${id}-t`}>{title}</title>
        {axis.ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
            {!hideValues && (
              <text x={PAD.left - 10} y={y(v) + 4} textAnchor="end" fontSize={12} fill="var(--muted)">
                {v.toFixed(2)}
              </text>
            )}
          </g>
        ))}
        {/* The axis does not start at 0: two short slashes under the left axis. */}
        {axis.min > 0 && (
          <g aria-hidden="true" stroke="var(--muted)" strokeWidth={1.5}>
            <line x1={PAD.left - 5} y1={bottom + 9} x2={PAD.left - 1} y2={bottom + 3} />
            <line x1={PAD.left - 1} y1={bottom + 9} x2={PAD.left + 3} y2={bottom + 3} />
          </g>
        )}
        {points.length > 1 && <path d={path} fill="none" stroke="var(--text)" strokeWidth={2} strokeLinejoin="round" />}
        {points.map((p, i) => (
          <g key={`${p.label}-${i}`}>
            {!hideValues && (
              <text x={x(i)} y={y(p.ips) - 10} textAnchor="middle" fontSize={12} fill="var(--text)">
                {p.ips.toFixed(2)}
              </text>
            )}
            <circle
              cx={x(i)}
              cy={y(p.ips)}
              r={active === i ? 6 : 4.5}
              fill="var(--surface)"
              stroke="var(--text)"
              strokeWidth={2}
              tabIndex={hideValues ? -1 : 0}
              aria-label={hideValues ? p.label : p.text}
              className="cursor-pointer outline-none focus-ring:stroke-[var(--focus)]"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              {!hideValues && <title>{p.text}</title>}
            </circle>
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--muted)">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
      {axis.min > 0 && <p className="mt-1 text-[12px] text-muted-foreground">{note(axis.min.toFixed(2))}</p>}
      {shown && (
        <p role="status" className="pointer-events-none absolute top-0 right-0 rounded-md bg-foreground px-2 py-1 text-[12px] text-background">
          {shown.text}
        </p>
      )}
    </div>
  );
}
