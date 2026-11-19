// The Android app's controls (M8c.1): pill buttons, round icon buttons, the
// 28 px check circle and the pill segmented control. Every one has a touch
// target of at least 44 (m-hit), focus rings for keyboards only.

import { Switch as SwitchPrimitive } from 'radix-ui';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { XIcon } from '../dashboard-icons';
import { ChevronDownIcon } from '../icons';

const ring = 'outline-none focus-ring:ring-2 focus-ring:ring-focus';

/** Primary: a 44 pill in the accent. Secondary: a 40 pill on the inset layer. */
/** A pill button; with `href` it is a plain outside link that opens a new tab (CLAUDE.md, "Tautan ke layanan luar"). */
export function PillButton({ children, onPress, href, kind = 'secondary', disabled = false, full = false, icon: Icon, small = false, danger = false }: { children: ReactNode; onPress?: () => void; href?: string; kind?: 'primary' | 'secondary'; disabled?: boolean; full?: boolean; icon?: ComponentType<SVGProps<SVGSVGElement>>; small?: boolean; danger?: boolean }) {
  const size = small ? 'h-8 px-3 text-m13' : kind === 'primary' ? 'h-11 px-5 text-m15' : 'h-10 px-4 text-m15';
  const look = kind === 'primary' ? 'bg-primary text-primary-foreground' : danger ? 'bg-m-inset text-urgency-overdue' : 'bg-m-inset text-foreground';
  const cls = `m-hit m-press inline-flex items-center justify-center gap-2 rounded-full ${size} ${look} ${full ? 'w-full' : ''} ${ring} disabled:opacity-50`;
  const inner = (
    <>
      {Icon && <Icon className="size-4" />}
      {children}
    </>
  );
  if (href)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    );
  return (
    <button type="button" onClick={onPress} disabled={disabled} className={cls}>
      {inner}
    </button>
  );
}

/** A 40 circle on the card layer, with one icon; its label is for TalkBack. */
export function IconButton({ icon: Icon, label, onPress, disabled = false, spinning = false, href, inset = false }: { icon: ComponentType<SVGProps<SVGSVGElement>>; label: string; onPress?: () => void; disabled?: boolean; spinning?: boolean; href?: string; inset?: boolean }) {
  const cls = `m-hit m-press inline-flex size-10 shrink-0 items-center justify-center rounded-full ${inset ? 'bg-m-inset' : 'm-card'} text-foreground ${ring} disabled:opacity-50`;
  const icon = <Icon className={`size-5 ${spinning ? 'animate-spin motion-reduce:animate-none' : ''}`} />;
  if (href)
    return (
      <a href={href} aria-label={label} className={cls}>
        {icon}
      </a>
    );
  return (
    <button type="button" aria-label={label} onClick={onPress} disabled={disabled} className={cls}>
      {icon}
    </button>
  );
}

/** Done or not: a 28 circle (44 target) that fills when checked. `sm` is the desktop size (22), for the extension's rows. */
export function CheckCircle({ checked, onChange, label, size = 'md' }: { checked: boolean; onChange: (v: boolean) => void; label: string; size?: 'md' | 'sm' }) {
  return (
    <button
      type="button"
      role="checkbox"
      data-own-press=""
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`m-hit inline-flex ${size === 'sm' ? 'size-[22px]' : 'size-7'} shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150 motion-reduce:transition-none ${checked ? 'border-foreground bg-foreground text-bg' : 'border-muted-foreground text-transparent'} ${ring}`}
    >
      <svg viewBox="0 0 24 24" className={size === 'sm' ? 'size-3' : 'size-4'} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.5 10 17 19 7.5" />
      </svg>
    </button>
  );
}

/** Pill segmented control (36). */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="grid h-9 grid-flow-col auto-cols-fr gap-1 rounded-full bg-m-inset p-1">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} className={`m-hit rounded-full text-m13 ${ring} ${value === o.value ? 'm-card font-medium text-foreground' : 'text-muted-foreground'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A switch for the phone (Radix Switch): a 52x32 pill, the knob on the card
 * layer so it reads on the dark "on" track in both themes; 44 target.
 */
export function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      aria-label={label}
      className={`m-hit relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full transition-colors duration-150 motion-reduce:transition-none ${checked ? 'bg-foreground' : 'bg-m-inset'} ${ring} disabled:opacity-50`}
    >
      <SwitchPrimitive.Thumb className="block size-6 translate-x-1 rounded-full bg-m-card shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-transform duration-150 data-[state=checked]:translate-x-[24px] motion-reduce:transition-none" />
    </SwitchPrimitive.Root>
  );
}

/**
 * A filter button for a choice with many or long options (36 high, sharing
 * the row's width): tapping the label opens its sheet. Inactive: the inset
 * layer and a small chevron. Active: filled with the text color, the chosen
 * option as its label (ellipsis when long) and an X with a 44 px touch area
 * that clears it.
 */
export function FilterPill({ label, active, onOpen, onClear, clearLabel }: { label: string; active: boolean; onOpen: () => void; onClear: () => void; clearLabel: string }) {
  return (
    <div className={`flex h-9 min-w-0 flex-1 items-center rounded-full ${active ? 'bg-foreground text-bg' : 'bg-m-inset text-foreground'}`}>
      <button type="button" aria-haspopup="dialog" onClick={onOpen} className={`m-hit flex h-full min-w-0 flex-1 items-center gap-1 rounded-full pl-4 text-left text-m13 ${active ? 'pr-1' : 'pr-3'} ${ring}`}>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {!active && <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
      </button>
      {active && (
        <button type="button" onClick={onClear} aria-label={clearLabel} className={`m-hit mr-1 flex size-7 shrink-0 items-center justify-center rounded-full ${ring}`}>
          <XIcon aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </div>
  );
}
