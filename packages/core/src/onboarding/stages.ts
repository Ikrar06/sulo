// The extension's "Menyiapkan Sulo" (Tahap 2): the real stages of the setup
// sync as they finish (runSync's onStage), put in session storage by the
// background for the setup page. Only which stage ended and how; the page
// reads the counts from the stored data itself.

import type { SyncStage } from '../sync/run-sync';

export const ONBOARDING_STAGES_KEY = 'onboarding:stages';

export interface OnboardingStages {
  /** When the list was last written (ms). */
  at: number;
  stages: { stage: SyncStage; result: 'ok' | 'failed' }[];
}

/** The rows the setup page shows, in order. */
export const STAGE_ROWS: readonly SyncStage[] = ['tasks', 'courses', 'attendance'];

/** The result of each row so far (null: still running), from the stages in the order they came. */
export function stageResults(stages: OnboardingStages['stages']): Record<SyncStage, 'ok' | 'failed' | null> {
  const out: Record<SyncStage, 'ok' | 'failed' | null> = { tasks: null, courses: null, attendance: null };
  for (const s of stages) out[s.stage] = s.result;
  return out;
}
