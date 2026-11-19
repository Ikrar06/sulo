// Pengaturan's building blocks: a group card with its 13 px title and an
// optional note, a setting row (label, help, control) and a value row that
// opens a bottom sheet. Rows sit inside the card with inset hairlines.

import type { ReactNode } from 'react';
import { ChevronRightIcon } from '@sulo/ui/icons';

export function Group({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-m13 font-semibold text-muted-foreground">{title}</h2>
      <div className="m-card rounded-card px-4 py-1">{children}</div>
      {help && <p className="mt-2 px-1 text-m12 font-normal text-muted-foreground">{help}</p>}
    </section>
  );
}

/** A setting: its label (and help) on the left, its control on the right; an inset hairline between rows. */
export function Row({ label, help, dim = false, children }: { label: string; help?: string; dim?: boolean; children: ReactNode }) {
  return (
    <div className={`flex min-h-12 items-center gap-3 py-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-m-line ${dim ? 'opacity-50' : ''}`}>
      <span className="min-w-0 flex-1">
        <span className="block text-m15 font-normal">{label}</span>
        {help && <span className="block text-m12 font-normal text-muted-foreground">{help}</span>}
      </span>
      {children}
    </div>
  );
}

/** A value on the right that opens a bottom sheet. */
export function ValueRow({ label, help, value, onPress, disabled = false }: { label: string; help?: string; value: string; onPress: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onPress} className="m-hit flex min-h-12 w-full items-center gap-3 py-2 text-left outline-none disabled:opacity-50 focus-ring:ring-2 focus-ring:ring-focus [&:not(:last-child)]:border-b [&:not(:last-child)]:border-m-line">
      <span className="min-w-0 flex-1">
        <span className="block text-m15 font-normal">{label}</span>
        {help && <span className="block text-m12 font-normal text-muted-foreground">{help}</span>}
      </span>
      {value && <span className="text-m13 text-muted-foreground tabular-nums">{value}</span>}
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
