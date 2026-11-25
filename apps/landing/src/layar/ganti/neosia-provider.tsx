// Stand-in for apps/mobile/src/neosia/NeosiaProvider.tsx: NEOSIA as the app
// ships it (off until the student turns it on), supported, no grades ever.
// The user guide shows the connected screens too: NeosiaContoh hands in the
// synthetic snapshots, cut by the app's own grade guard (the screens get
// everything but the grades, as on a phone; useGrades stays empty, so Nilai
// and the Studi card show their hidden state).
import { createContext, useContext, type ReactNode } from 'react';
import type { EndpointId } from '@sulo/core/neosia/allowlist';
import { sourcesDoneIn } from '@sulo/core/neosia/checklist';
import type { CourseMap } from '@sulo/core/neosia/course-map';
import type { NeosiaSnapshot, Snapshots } from '@sulo/core/neosia/store';
import { GRADE_ENDPOINTS, withoutGrades } from '../../../../mobile/src/neosia/grade-guard';

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

const Contoh = createContext<typeof OFF>(OFF);

/** NEOSIA connected, with these snapshots (the same ones the extension's sample dashboard reads). */
export function NeosiaContoh({ snapshots, courseMap, children }: { snapshots: Snapshots; courseMap: CourseMap; children: ReactNode }) {
  const semua = Object.entries(snapshots) as [EndpointId, NeosiaSnapshot][];
  const tanpaNilai = Object.fromEntries(semua.filter(([e]) => !GRADE_ENDPOINTS.has(e)).map(([e, s]) => [e, { ...s, data: withoutGrades(s.data) }]));
  return <Contoh.Provider value={{ ...OFF, enabled: true, signedIn: true, snapshots: tanpaNilai, done: sourcesDoneIn(snapshots), courseMap }}>{children}</Contoh.Provider>;
}

export const useNeosia = () => useContext(Contoh) as never;
export function useGrades(): null {
  return null;
}
export function NeosiaProvider({ children }: { platform: unknown; children: ReactNode }) {
  return <>{children}</>;
}
