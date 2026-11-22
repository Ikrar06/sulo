import { createContext } from 'react';

/**
 * Where mascots live may hold them still: `paused` for a part of the page
 * that is mounted but not shown; `lite` for the phone's lite tier, where the
 * body stays still and only a blink and a change of the eyes remain.
 */
export interface MascotScope {
  paused?: boolean;
  lite?: boolean;
}

export const MascotScopeContext = createContext<MascotScope>({});
