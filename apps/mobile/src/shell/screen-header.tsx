// A screen's own round buttons render into the header bar through a portal
// (Tugas: search; Kabar: notification settings), so no state goes back and
// forth. The main and end slots are kept for screens that may need them;
// none does now (Ringkasan's greeting scrolls with its content).

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
