// A page's own buttons in the dashboard header, beside Perbarui (the phone's shell/screen-header.tsx does the
// same). Actions sit up there with the other pill buttons; the row under the title keeps only the filters,
// whose fields and selects share the control radius.

import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const HeaderToolsSlot = createContext<HTMLElement | null>(null);

export function HeaderTools({ children }: { children: ReactNode }) {
  const slot = useContext(HeaderToolsSlot);
  return slot ? createPortal(children, slot) : null;
}
