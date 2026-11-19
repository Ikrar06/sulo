// A temporary date filter for Tugas, set by tapping a day on Ringkasan's
// 7-day card. The shell holds it and clears it once Tugas is left, so it
// never outlives the visit (a removable chip on Tugas clears it too).

import { createContext, useContext } from 'react';

export interface TaskDate {
  /** A local date key ("2026-11-20") or null for no filter. */
  date: string | null;
  setDate: (date: string | null) => void;
}

const Ctx = createContext<TaskDate>({ date: null, setDate: () => undefined });
export const TaskDateProvider = Ctx.Provider;
export const useTaskDate = (): TaskDate => useContext(Ctx);
