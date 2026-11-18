// IPS per semester (Nilai page, M7.1): a plain line with dots, drawn with SVG
// here (no chart library), as wide as its card in real pixels. The y axis
// adapts (lib/grades/axis.ts). One tooltip follows the point under the
// pointer (a column one x step wide) or the focused point (Tab, arrow keys);
// it resets when the pointer leaves. No SVG <title> anywhere: browsers show
// those as a second, native tooltip. With grades hidden or privacy mode on,
// the line stays and every number goes.

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { yAxisRange } from '@sulo/core/grades/axis';
import { columns, labelPlacements, tooltipPosition } from '@sulo/core/grades/chart-layout';

export interface GpaPoint {
  label: string;
  ips: number;
  sks: number;
  /** "{semester} · IPS {value} · {credits} SKS": the tooltip and the dot's label. */
  text: string;
}

const DEFAULT_W = 640;
const H = 232;
/** Left: room for the y labels outside the plot; top: room for value labels above a 4.00 dot. */
const PAD = { left: 56, right: 24, top: 28, bottom: 32 };
/** The first and last dots keep clear of the plot's edges. */
const INSET = 28;
/** The y labels sit this far left of the axis. */
const Y_LABEL_GAP = 8;

export function GpaChart({ points, title, hideValues }: { points: readonly GpaPoint[]; title: string; hideValues: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const tip = useRef<HTMLDivElement | null>(null);
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const [W, setW] = useState(DEFAULT_W);
  const [tipSize, setTipSize] = useState({ width: 160, height: 28 });
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
  const plotLeft = PAD.left;
  const plotRight = W - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const span = plotRight - plotLeft - 2 * INSET;
  const xs = points.map((_, i) => plotLeft + INSET + (points.length === 1 ? span / 2 : (i / (points.length - 1)) * span));
  const y = (v: number) => PAD.top + (1 - (Math.max(axis.min, Math.min(axis.max, v)) - axis.min) / (axis.max - axis.min)) * innerH;
  const ys = points.map((p) => y(p.ips));
  const path = points.map((_, i) => `${i === 0 ? 'M' : 'L'}${xs[i]!.toFixed(1)},${ys[i]!.toFixed(1)}`).join(' ');
  const bands = columns(xs, plotLeft, plotRight);
  const placements = labelPlacements(xs.map((x, i) => ({ x, y: ys[i]! })));
  const bottom = PAD.top + innerH;
  const current = active === null || hideValues ? null : points[active];

  // The tooltip's real size, so it can stay inside the card.
  useLayoutEffect(() => {
    if (tip.current) setTipSize({ width: tip.current.offsetWidth, height: tip.current.offsetHeight });
  }, [current?.text]);
  const position = active === null ? null : tooltipPosition({ x: xs[active]!, y: ys[active]! }, tipSize, W);

  const onKey = (i: number) => (e: KeyboardEvent<SVGCircleElement>) => {
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
    if (next === null || next < 0 || next >= points.length) return;
    e.preventDefault();
    dots.current[next]?.focus();
  };

  return (
    <div ref={box} className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="group" aria-label={title} onMouseLeave={() => setActive(null)}>
        {axis.ticks.map((v) => (
          <g key={v}>
            <line x1={plotLeft} x2={plotRight} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
            {!hideValues && (
              <text x={plotLeft - Y_LABEL_GAP} y={y(v) + 4} textAnchor="end" fontSize={12} fill="var(--muted)">
                {v.toFixed(2)}
              </text>
            )}
          </g>
        ))}
        {/* The axis does not start at 0: two short slashes under the left axis. */}
        {axis.min > 0 && (
          <g aria-hidden="true" stroke="var(--muted)" strokeWidth={1.5}>
            <line x1={plotLeft - 5} y1={bottom + 9} x2={plotLeft - 1} y2={bottom + 3} />
            <line x1={plotLeft - 1} y1={bottom + 9} x2={plotLeft + 3} y2={bottom + 3} />
          </g>
        )}
        {points.length > 1 && <path d={path} fill="none" stroke="var(--text)" strokeWidth={2} strokeLinejoin="round" />}
        {/* Hover areas: one column per point, one x step wide. */}
        {bands.map((b, i) => (
          <rect key={`band-${i}`} x={b.left} y={PAD.top - 20} width={b.width} height={innerH + 40} fill="transparent" onMouseEnter={() => setActive(i)} />
        ))}
        {points.map((p, i) => (
          <g key={`${p.label}-${i}`}>
            {!hideValues && (
              <text x={xs[i]} y={placements[i] === 'above' ? ys[i]! - 10 : ys[i]! + 20} textAnchor="middle" fontSize={12} fill="var(--text)" pointerEvents="none">
                {p.ips.toFixed(2)}
              </text>
            )}
            <circle
              ref={(el) => void (dots.current[i] = el)}
              cx={xs[i]}
              cy={ys[i]}
              r={active === i ? 6 : 4.5}
              fill="var(--surface)"
              stroke="var(--text)"
              strokeWidth={2}
              tabIndex={0}
              role="img"
              aria-label={hideValues ? p.label : p.text}
              className="cursor-pointer outline-none focus-ring:stroke-[var(--focus)]"
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onKeyDown={onKey(i)}
            />
            <text x={xs[i]} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--muted)" pointerEvents="none">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
      {current && position && (
        <div
          ref={tip}
          aria-hidden="true"
          className="pointer-events-none absolute z-10 rounded-md bg-foreground px-2 py-1 text-[12px] whitespace-nowrap text-background"
          style={{ left: position.left, top: position.top }}
        >
          {current.text}
        </div>
      )}
    </div>
  );
}
