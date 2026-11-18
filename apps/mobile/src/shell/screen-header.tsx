// A screen's large header can be its own content (Ringkasan's greeting and
// mascot): it renders into the header's slots through a portal, so no state
// goes back and forth. When the main slot is filled, the header's own 26 px
// name hides (styles.css, .m-head:has); scrolled, the header hides the slots.

import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface HeaderSlots {
  main: HTMLElement | null;
  end: HTMLElement | null;
  tools: HTMLElement | null;
}

const Ctx = createContext<HeaderSlots>({ main: null, end: null, tools: null });

export const ScreenHeaderProvider = Ctx.Provider;

/** The screen's large header: `main` on the left, `end` at the far right after the buttons. */
export function LargeHeader({ main, end }: { main: ReactNode; end?: ReactNode }) {
  const slots = useContext(Ctx);
  return (
    <>
      {slots.main && createPortal(main, slots.main)}
      {slots.end && end && createPortal(end, slots.end)}
    </>
  );
}

/** The screen's own round buttons, before Perbarui (Tugas: search); they stay when the header is small. */
export function HeaderTools({ children }: { children: ReactNode }) {
  const slots = useContext(Ctx);
  return slots.tools ? createPortal(children, slots.tools) : null;
}
