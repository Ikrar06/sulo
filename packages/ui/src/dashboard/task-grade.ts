// "Lihat nilai" in a task's details: hidden until the student asks, then one answer (core tasks/grade-service.ts
// through the platform). Leaving the task, or "Sembunyikan", hides it again; nothing is shown on its own.

import { useState } from 'react';
import type { TaskGradeOutcome } from '@sulo/core/tasks/grade-service';

export type TaskGradeState = { phase: 'hidden' } | { phase: 'loading' } | { phase: 'shown'; outcome: TaskGradeOutcome };

export function useTaskGrade(fetchGrade: (again: boolean) => Promise<TaskGradeOutcome>) {
  const [state, setState] = useState<TaskGradeState>({ phase: 'hidden' });
  const ask = async (again: boolean) => {
    setState({ phase: 'loading' });
    let outcome: TaskGradeOutcome;
    try {
      outcome = await fetchGrade(again);
    } catch {
      outcome = { status: 'failed', reason: 'ERROR' };
    }
    setState({ phase: 'shown', outcome });
  };
  return {
    state,
    see: () => void ask(false),
    again: () => void ask(true),
    hide: () => setState({ phase: 'hidden' }),
  };
}
