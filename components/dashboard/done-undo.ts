import { useCallback, useReducer, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import type { DashMessages } from '@/lib/i18n/dashboard';
import { bumpUsage } from '@/lib/stats/usage';
import { COLLAPSE_MS, EMPTY_UNDO, markDone, UNDO_MS, undoDone, undoReducer } from '@/lib/tasks/done-undo';
import type { DashboardActions } from './data';
import { local } from './data';

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Mark a task done from the dashboard: saved at once (its reminders drop at
 * once), the row stays in place with the done style, and one toast offers
 * Urungkan for 5 seconds (paused while hovered or focused). When the window
 * ends, a row the filter would hide collapses (200 ms) and leaves.
 */
export function useDoneUndo(actions: DashboardActions, d: DashMessages, today: string) {
  const [state, dispatch] = useReducer(undoReducer, EMPTY_UNDO);
  const [collapsing, setCollapsing] = useState<ReadonlySet<number>>(new Set());
  const toast = useToast();
  const latest = useRef<number | null>(null);
  // Set when the last pending task was just marked: the empty list celebrates once.
  const [justCleared, setJustCleared] = useState(false);

  const leave = useCallback((eventId: number) => {
    if (reducedMotion()) {
      dispatch({ kind: 'expire', eventId });
      return;
    }
    setCollapsing((s) => new Set(s).add(eventId));
    window.setTimeout(() => {
      dispatch({ kind: 'expire', eventId });
      setCollapsing((s) => {
        const next = new Set(s);
        next.delete(eventId);
        return next;
      });
    }, COLLAPSE_MS);
  }, []);

  const mark = useCallback(
    (eventId: number, lastPending = false) => {
      void actions.updateUser('taskState', (m) => markDone(m, eventId));
      void bumpUsage(local, today, 'tasksMarkedDone');
      // A newer mark takes over the toast; the previous row's window ends now.
      if (latest.current !== null && latest.current !== eventId) leave(latest.current);
      latest.current = eventId;
      dispatch({ kind: 'mark', eventId });
      setJustCleared(lastPending);
      toast.show({
        message: d.tugas.markedDone,
        duration: UNDO_MS,
        action: {
          label: d.tugas.undo,
          onClick: () => {
            void actions.updateUser('taskState', (m) => undoDone(m, eventId));
            latest.current = null;
            setJustCleared(false);
            dispatch({ kind: 'undo' });
          },
        },
        onTimeout: () => {
          if (latest.current === eventId) latest.current = null;
          leave(eventId);
        },
      });
    },
    [actions, d, today, toast, leave],
  );

  /** Unchecking a done task is not an undo: it simply marks it pending again. */
  const unmark = useCallback((eventId: number) => void actions.updateUser('taskState', (m) => undoDone(m, eventId)), [actions]);

  return { lingering: new Set(state.lingering), collapsing, mark, unmark, justCleared };
}
