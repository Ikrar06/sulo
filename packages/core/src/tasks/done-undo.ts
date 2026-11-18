// "Ditandai selesai" with Urungkan, in the dashboard and the popup. Pure.
//
// Marking writes doneManually at once (so the task's reminders are dropped
// at once: the planner skips done tasks on its next run), keeps the row in
// place for UNDO_MS, and shows one toast. A later mark replaces the toast;
// Urungkan applies to the latest only. Older marks stay done and can be
// brought back through the "Ditandai selesai" filter. Local only.

import { setDone, type TaskStateMap } from './local-state';

export const UNDO_MS = 5000;
/** Row height collapse after the undo window, when the filter hides done tasks. */
export const COLLAPSE_MS = 200;

export interface UndoState {
  /** The task the toast's Urungkan restores; null when no toast is shown. */
  toast: number | null;
  /** Rows kept in place although the filter would hide them (just marked). */
  lingering: readonly number[];
}

export const EMPTY_UNDO: UndoState = { toast: null, lingering: [] };

export type UndoAction = { kind: 'mark'; eventId: number } | { kind: 'undo' } | { kind: 'expire'; eventId: number };

export function undoReducer(state: UndoState, action: UndoAction): UndoState {
  switch (action.kind) {
    case 'mark':
      return { toast: action.eventId, lingering: [...state.lingering.filter((id) => id !== action.eventId), action.eventId] };
    case 'undo':
      return state.toast === null ? state : { toast: null, lingering: state.lingering.filter((id) => id !== state.toast) };
    case 'expire':
      return { toast: state.toast === action.eventId ? null : state.toast, lingering: state.lingering.filter((id) => id !== action.eventId) };
  }
}

export const markDone = (map: TaskStateMap, eventId: number): TaskStateMap => setDone(map, eventId, true);
export const undoDone = (map: TaskStateMap, eventId: number): TaskStateMap => setDone(map, eventId, false);
