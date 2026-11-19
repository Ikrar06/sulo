// When each row of "Menyiapkan Sulo" shows its result (M8c.2). The rows
// follow the real sync stages; a stage that ends very quickly still shows
// its check for at least MIN_SHOWN_MS before the next row changes, so it can
// be read, and the extra wait over the real end is never more than
// MAX_EXTRA_MS in total. Pure, so it can be tested.

export const PREP_ROWS = ['tasks', 'courses', 'calendar', 'attendance'] as const;
export type PrepRow = (typeof PREP_ROWS)[number];
export type RowResult = 'ok' | 'failed';

export const MIN_SHOWN_MS = 250;
export const MAX_EXTRA_MS = 1200;

export interface StageEvent {
  row: PrepRow;
  result: RowResult;
  /** When the stage really ended (ms, any clock). */
  at: number;
}

/**
 * The time each row shows its result, in row order. Rows without an event
 * yet are left out (they keep spinning). Each row waits for the one above it.
 */
export function shownTimes(events: readonly StageEvent[]): { row: PrepRow; result: RowResult; showAt: number }[] {
  const out: { row: PrepRow; result: RowResult; showAt: number }[] = [];
  let prev: number | null = null;
  for (const row of PREP_ROWS) {
    const e = events.find((x) => x.row === row);
    if (!e) break;
    const wanted: number = prev === null ? e.at : Math.max(e.at, prev + MIN_SHOWN_MS);
    // Never more than MAX_EXTRA_MS behind the stage's real end.
    const showAt = Math.min(wanted, e.at + MAX_EXTRA_MS);
    out.push({ row, result: e.result, showAt });
    prev = showAt;
  }
  return out;
}

/** The first sync's result for the flow: no tasks is a failure; any other failed row is partial. */
export function prepOutcome(events: readonly StageEvent[], syncOk: boolean): 'ok' | 'partial' | 'failed' {
  const tasks = events.find((e) => e.row === 'tasks');
  if (!tasks || tasks.result === 'failed') return 'failed';
  return syncOk && events.every((e) => e.result === 'ok') ? 'ok' : 'partial';
}
