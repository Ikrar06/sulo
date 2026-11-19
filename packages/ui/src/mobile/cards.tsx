// The Android app's card patterns (M8c.1). Cards float on the screen layer:
// radius 20 (hero 24), 16 padding, 12 between cards, never a card in a card,
// never a full-width divider. Sizes are the phone's tokens (text-m*), which
// only the app's stylesheet defines; the extension does not scan this folder.

import type { ComponentType, ReactNode, SVGProps } from 'react';
import { ON_SOLID, tintBg, tintIcon, tintVar, type TintColor } from './tint';

const ring = 'outline-none focus-ring:ring-2 focus-ring:ring-focus';

/**
 * A card. With `onPress` the whole card opens something: a cover button
 * fills it (label for TalkBack) and its content sits above, so controls
 * inside (a check circle) stay their own buttons, never nested. Pressed, the
 * card settles to 0.98.
 */
/** dense: 14 all round instead of 16 (list cards: a task is about 84 high). */
/** `inner` styles the content wrapper of a pressable card (e.g. a column that fills its height). */
export function Card({ children, className = '', inner = '', onPress, label, hero = false, dense = false, style }: { children: ReactNode; className?: string; inner?: string; onPress?: () => void; label?: string; hero?: boolean; dense?: boolean; style?: React.CSSProperties }) {
  const radius = hero ? 'rounded-hero' : 'rounded-card';
  const pad = dense ? 'p-3.5' : 'p-4';
  if (onPress)
    return (
      <section className={`m-card m-press-host relative ${radius} ${className}`} style={style}>
        <button type="button" onClick={onPress} aria-label={label} className={`m-cover absolute inset-0 ${radius} ${ring}`} />
        <div className={`pointer-events-none relative ${pad} ${inner} [&_[data-own-press]]:pointer-events-auto`}>{children}</div>
      </section>
    );
  return (
    <section className={`m-card ${pad} ${radius} ${className} ${inner}`} style={style}>
      {children}
    </section>
  );
}

/** A section's heading: title 15 semibold, an optional "Lihat semua" link on the right. */
export function SectionHead({ title, action, id }: { title: string; action?: { label: string; onPress: () => void }; id?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="text-m15 font-semibold">
        {title}
      </h2>
      {action && (
        <button type="button" onClick={action.onPress} className={`m-hit text-m13 text-muted-foreground ${ring} rounded`}>
          {action.label}
        </button>
      )}
    </div>
  );
}

/** A square tile: a soft tint behind an icon or a date, or (solid) a course's own color behind its initials in dark text. */
export function Tile({ color, size = 36, children, label, solid = false }: { color: TintColor | null | undefined; size?: 32 | 36 | 40 | 44 | 64; children: ReactNode; label?: string; solid?: boolean }) {
  const box = size === 64 ? 'size-16' : size === 44 ? 'size-11' : size === 40 ? 'size-10' : size === 32 ? 'size-8' : 'size-9';
  // 32: the course initial tile in a list row (radius 10, initials 12 bold).
  const shape = size === 64 ? 'rounded-[18px] text-m13 font-semibold' : size === 32 ? 'rounded-[10px] text-[12px] font-bold' : 'rounded-ctl text-m13 font-semibold';
  const style = solid ? { background: tintVar(color), ...ON_SOLID } : { background: tintBg(color, 18), color: 'var(--text)' };
  return (
    <span role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={`${box} flex shrink-0 flex-col items-center justify-center ${shape}`} style={style}>
      {children}
    </span>
  );
}

/** A tile with one icon in its color, mixed toward the text color for contrast. */
export function IconTile({ color, icon: Icon, size = 36 }: { color: TintColor | null | undefined; icon: ComponentType<SVGProps<SVGSVGElement>>; size?: 36 | 40 | 44 | 64 }) {
  return (
    <Tile color={color} size={size}>
      <Icon className={size === 64 ? 'size-7' : 'size-5'} style={{ color: tintIcon(color) }} />
    </Tile>
  );
}

/** A pill chip (30): a dot or a tint in its color; `selected` fills it with the text color. */
export function Chip({ children, color, dot = false, selected, onPress, small = false, dashed = false }: { children: ReactNode; color?: TintColor | null; dot?: boolean; selected?: boolean; onPress?: () => void; small?: boolean; dashed?: boolean }) {
  const size = small ? 'h-6 px-2 text-m12' : 'h-[30px] px-3 text-m12';
  const look = selected ? 'bg-foreground text-bg' : dashed ? 'border border-dashed border-m-line text-muted-foreground' : '';
  const style = !selected && !dashed && color && !dot ? { background: tintBg(color, 16, 'var(--m-card)') } : !selected && !dashed ? { background: 'var(--m-inset)' } : undefined;
  const inner = (
    <>
      {dot && <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: tintVar(color) }} />}
      <span className="truncate">{children}</span>
    </>
  );
  const cls = `inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full ${size} ${look}`;
  if (onPress)
    return (
      <button type="button" aria-pressed={selected} onClick={onPress} className={`m-hit ${cls} ${ring}`} style={style}>
        {inner}
      </button>
    );
  return (
    <span className={cls} style={style}>
      {inner}
    </span>
  );
}

/** A small statistic: label 12, number 22, a note 12. */
export function StatCard({ label, value, note, accent = false, warn = false }: { label: string; value: string; note?: string; accent?: boolean; warn?: boolean }) {
  return (
    <section className="m-card min-w-0 rounded-card p-3">
      <p className="truncate text-m12 font-normal text-muted-foreground">{label}</p>
      <p className={`mt-1 text-m22 tabular-nums ${accent ? 'db-accent-text' : warn ? 'text-urgency-overdue' : ''}`}>{value}</p>
      {note && <p className="truncate text-m12 font-normal text-muted-foreground">{note}</p>}
    </section>
  );
}

/** A card holding up to five short rows of one kind, divided by inset hairlines. */
export function GroupCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`m-card rounded-card px-4 py-1 ${className}`}>{children}</section>;
}

/** A row inside a GroupCard: 12 vertical padding, an inset hairline under all but the last. */
export function GroupRow({ children, onPress, label }: { children: ReactNode; onPress?: () => void; label?: string }) {
  const cls = 'flex w-full min-h-12 items-center gap-3 py-3 text-left [&:not(:last-child)]:border-b [&:not(:last-child)]:border-m-line';
  if (onPress)
    return (
      <button type="button" onClick={onPress} aria-label={label} className={`m-press ${cls} ${ring} rounded-[8px]`}>
        {children}
      </button>
    );
  return <div className={cls}>{children}</div>;
}

/** An empty state inside a card: the mascot slot (48) and one sentence. */
export function EmptyCard({ mascot, text }: { mascot?: ReactNode; text: string }) {
  return (
    <section className="m-card flex flex-col items-center gap-3 rounded-card px-4 py-6 text-center">
      {mascot}
      <p className="text-m13 text-muted-foreground">{text}</p>
    </section>
  );
}
