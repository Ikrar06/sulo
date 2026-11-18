// One way to update per screen: the app bar's icon and pull to refresh.
// A screen whose update is not a sync (Presensi's Perbarui) registers its
// own; every other screen uses the app's sync.

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

type Refresh = () => Promise<string>;

const Ctx = createContext<{ current: Refresh | null } | null>(null);

export function ScreenRefreshProvider({ slot, children }: { slot: { current: Refresh | null }; children: ReactNode }) {
  return <Ctx.Provider value={slot}>{children}</Ctx.Provider>;
}

/** While this screen shows, Perbarui runs `refresh` (resolves with the line to show). */
export function useScreenRefresh(refresh: Refresh): void {
  const slot = useContext(Ctx);
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    if (!slot) return;
    const run: Refresh = () => latest.current();
    slot.current = run;
    return () => {
      if (slot.current === run) slot.current = null;
    };
  }, [slot]);
}
