// Stand-in for apps/mobile/src/shell/data.tsx on the landing page: the same
// exports, the data handed in (built once, ../contoh.ts), nothing read from a
// phone. Times show in WITA, the students' own zone.
import { createContext, useContext, type ReactNode } from 'react';
import type { Platform } from '@sulo/core/platform';
import type { Prefs } from '@sulo/core/prefs';
import type { UserData } from '@sulo/core/storage';
import type { DashboardData } from '@sulo/core/view/dashboard-data';

export const timeZone = 'Asia/Makassar';

export interface MobileActions {
  updateUser: <K extends keyof UserData>(name: K, change: (value: UserData[K]) => UserData[K]) => Promise<boolean>;
  setPrefs: (patch: Partial<Prefs>) => Promise<void>;
  openExternal: (url: string) => void;
}

interface Ctx {
  data: DashboardData | null;
  actions: MobileActions;
  platform: Platform;
  reload: () => Promise<void>;
}

const Data = createContext<Ctx | null>(null);

export function LandingMobileData({ value, children }: { value: Ctx; children: ReactNode }) {
  return <Data.Provider value={value}>{children}</Data.Provider>;
}

/** The app's own provider reads the phone; here the landing's one above has the data already. */
export function MobileDataProvider({ children }: { platform: Platform; children: ReactNode }) {
  return <>{children}</>;
}

export function useMobileData(): Ctx {
  const value = useContext(Data);
  if (!value) throw new Error('useMobileData outside LandingMobileData');
  return value;
}
