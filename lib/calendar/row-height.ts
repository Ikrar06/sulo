// Month grid row height: rows share the space below the grid, so a
// six-week month fits the window. Pure.

export const ROW_MIN = 88;
export const ROW_MAX = 128;
/** Below this height a row keeps two event lanes instead of three (the rest is "+n lagi"). */
export const THREE_LANES_MIN = 112;
/** Space kept under the grid. */
const BOTTOM_GAP = 16;

/** clamp(88, (window height - grid top - 16) / rows, 128), whole pixels; 1 px lines between rows are included. */
export function gridRowHeight(viewportHeight: number, gridTop: number, rows: number): number {
  if (rows <= 0) return ROW_MAX;
  const available = viewportHeight - gridTop - BOTTOM_GAP - (rows + 1);
  return Math.max(ROW_MIN, Math.min(ROW_MAX, Math.floor(available / rows)));
}

export function lanesForRow(rowHeight: number): 2 | 3 {
  return rowHeight >= THREE_LANES_MIN ? 3 : 2;
}
