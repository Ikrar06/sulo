// A solid progress ring (SVG): neutral track, the value in the text color.
// No gradient, no glow; nothing colored about a limit.

/** masked: privacy mode. Only the track is drawn, so the ring says nothing about the value; the caller's label must not carry it either. */
export function ProgressRing({ value, size = 64, stroke = 7, label, masked = false }: { value: number; size?: number; stroke?: number; label: string; masked?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--m-inset)" strokeWidth={stroke} />
      {!masked && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--text)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} />}
    </svg>
  );
}
