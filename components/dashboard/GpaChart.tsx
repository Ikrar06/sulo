// IPS per semester (Nilai page, M7.1): a plain line with dots on a 0 to 4
// axis, drawn with SVG here (no chart library). No gradient, no glow. Each
// dot is focusable and carries its value as a tooltip and label.

import { useEffect, useId, useRef, useState } from 'react';

export interface GpaPoint {
  label: string;
  ips: number;
  sks: number;
  /** Text for the tooltip and screen readers. */
  text: string;
}

/** Fallback width before the first measure. */
const DEFAULT_W = 640;
const H = 200;
const PAD = { left: 52, right: 44, top: 12, bottom: 28 };

export function GpaChart({ points, title }: { points: readonly GpaPoint[]; title: string }) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  // The drawing is as wide as the card, in real pixels, so text stays at its size.
  const box = useRef<HTMLDivElement | null>(null);
  const [W, setW] = useState(DEFAULT_W);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setW(Math.max(240, Math.round(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + (1 - Math.max(0, Math.min(4, v)) / 4) * innerH;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.ips).toFixed(1)}`).join(' ');
  const shown = active === null ? null : points[active];
  return (
    <div ref={box} className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-labelledby={`${id}-t`}>
        <title id={`${id}-t`}>{title}</title>
        {[0, 1, 2, 3, 4].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
            <text x={PAD.left - 12} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
              {v}
            </text>
          </g>
        ))}
        {points.length > 1 && <path d={path} fill="none" stroke="var(--text)" strokeWidth={2} strokeLinejoin="round" />}
        {points.map((p, i) => (
          <g key={p.label}>
            <circle
              cx={x(i)}
              cy={y(p.ips)}
              r={active === i ? 6 : 4.5}
              fill="var(--surface)"
              stroke="var(--text)"
              strokeWidth={2}
              tabIndex={0}
              aria-label={p.text}
              className="cursor-pointer outline-none focus-ring:stroke-[var(--focus)]"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <title>{p.text}</title>
            </circle>
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
      {shown && (
        <p role="status" className="pointer-events-none absolute top-0 right-0 rounded-md bg-foreground px-2 py-1 text-[12px] text-background">
          {shown.text}
        </p>
      )}
    </div>
  );
}
