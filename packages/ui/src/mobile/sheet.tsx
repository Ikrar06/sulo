// Bottom sheets for choices and menus on the phone (instead of a dropdown):
// a small handle, top radius 24, rising in 240 ms (styles in the app).
// Built on Radix Dialog for focus and Back/Escape handling.

import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { CheckIcon } from '../icons';

export function Sheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="m-scrim fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content aria-describedby={undefined} className="m-sheet fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-[24px] bg-m-card px-4 pt-2 outline-none" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
          <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-m-line" />
          <Dialog.Title className="mb-3 text-m18">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A list of options in a sheet: one row each, a check on the chosen one. */
export function SheetOptions<T extends string | number>({ value, options, onChoose }: { value: T; options: readonly { value: T; label: string }[]; onChoose: (v: T) => void }) {
  return (
    <ul role="listbox" className="rounded-card bg-m-inset px-4 py-1">
      {options.map((o) => (
        <li key={String(o.value)} role="option" aria-selected={o.value === value} className="[&:not(:last-child)]:border-b [&:not(:last-child)]:border-m-line">
          <button type="button" onClick={() => onChoose(o.value)} className="flex min-h-12 w-full items-center gap-3 text-left text-m15 outline-none focus-ring:ring-2 focus-ring:ring-focus">
            <span className="flex-1">{o.label}</span>
            {o.value === value && <CheckIcon className="size-4" />}
          </button>
        </li>
      ))}
    </ul>
  );
}
