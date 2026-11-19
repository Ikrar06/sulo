// An on/off setting as the phone shows it (Tahap 2, d13): the label on the
// left, the phone's switch on the right, the whole row one line high. Square
// checkboxes stay for choices among several options (which reminder times)
// and for filters.

import { useId, type ReactNode } from 'react';
import { Toggle } from '../mobile/controls';

export function SwitchRow({ checked, disabled, onChange, children }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  const id = useId();
  return (
    <div className={`flex min-h-10 items-center justify-between gap-4 py-1 ${disabled ? 'opacity-50' : ''}`}>
      <label htmlFor={id} className="min-w-0 text-(length:--fs-body) leading-(--lh-body)">
        {children}
      </label>
      <Toggle id={id} checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  );
}
