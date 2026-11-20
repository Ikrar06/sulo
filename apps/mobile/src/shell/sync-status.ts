// The one updating state every screen shows (owner's rules, 20 Nov 2026):
// running with the sync's real stage, then "Sudah terbaru" for 2 seconds, or
// a failure line with a retry. Pure, so the timing rules are tested.

import type { SyncStage } from '@sulo/core/sync/run-sync';

export type SyncPhase = 'idle' | 'running' | 'done' | 'failed';

export interface SyncUi {
  phase: SyncPhase;
  /** What is being fetched now (running only), from runSync's own stages. */
  stage: SyncStage | null;
  /** The failure's line (failed only). */
  message?: string;
}

export const IDLE: SyncUi = { phase: 'idle', stage: null };
/** A sync shorter than this still shows its updating state this long (no flicker). */
export const MIN_RUNNING_MS = 400;
/** "Sudah terbaru" stays this long, then the line goes. */
export const DONE_MS = 2000;

/** A sync starts at its first stage: the tasks. */
export const running = (): SyncUi => ({ phase: 'running', stage: 'tasks' });

/** runSync said a stage ended: the line moves to the next real one (a failed stage leaves it for the outcome). */
export function afterStage(ui: SyncUi, ended: SyncStage, result: 'ok' | 'failed'): SyncUi {
  if (ui.phase !== 'running' || result !== 'ok') return ui;
  const next: Record<SyncStage, SyncStage | null> = { tasks: 'courses', courses: 'attendance', attendance: null };
  return { ...ui, stage: next[ended] ?? ui.stage };
}

/** How much longer the running state must stay before the result shows. */
export const holdLeft = (startedAt: number, now: number): number => Math.max(0, MIN_RUNNING_MS - (now - startedAt));

/** The line for each phase. */
export function statusLine(ui: SyncUi, words: { updating: string; stages: Record<SyncStage, string>; upToDate: string }): string {
  if (ui.phase === 'running') return ui.stage ? words.stages[ui.stage] : words.updating;
  if (ui.phase === 'done') return words.upToDate;
  if (ui.phase === 'failed') return ui.message ?? '';
  return '';
}
