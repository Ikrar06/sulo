// Stand-in for apps/mobile/src/neosia/NeosiaProvider.tsx: NEOSIA as the app
// ships it (off until the student turns it on), supported, no grades ever.
import type { ReactNode } from 'react';

const OFF = {
  supported: true,
  enabled: false,
  snapshots: {},
  done: new Set(),
  next: null,
  needsLogin: false,
  signedIn: false,
  courseMap: {},
  enable: async () => undefined,
  disable: async () => undefined,
  open: async () => null,
  loadGrades: async () => ({}),
  reload: async () => undefined,
};

export const useNeosia = () => OFF as never;
export function useGrades(): null {
  return null;
}
export function NeosiaProvider({ children }: { platform: unknown; children: ReactNode }) {
  return <>{children}</>;
}
