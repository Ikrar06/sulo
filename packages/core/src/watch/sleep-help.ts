// The Android app's background watching: when to offer help because the
// phone holds the checks back (Doze, a maker's battery saver). Pure.

/** A check this much later than planned counts as held back. */
export const HELD_BACK_SEC = 2 * 3600;

/** One finished check: when it ran and when it had been planned for. */
export interface CheckTiming {
  ranAt: number;
  plannedAt: number;
}

/** True when the last two checks in a row each ran more than two hours late. */
export function sleepHelpDue(checks: readonly CheckTiming[]): boolean {
  if (checks.length < 2) return false;
  return checks.slice(-2).every((c) => c.ranAt - c.plannedAt > HELD_BACK_SEC);
}
