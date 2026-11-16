import { describe, expect, it } from 'vitest';
import { gridRowHeight, lanesForRow } from '../lib/calendar/row-height';

describe('month grid row height', () => {
  it('shares the height left under the grid, minus lines and a 16 px gap', () => {
    // 900 high, grid at 305: (900 - 305 - 16 - 7) / 6 = 95.
    expect(gridRowHeight(900, 305, 6)).toBe(95);
    expect(gridRowHeight(900, 305, 5)).toBe(114);
  });
  it('never below 88 or above 128', () => {
    expect(gridRowHeight(600, 400, 6)).toBe(88);
    expect(gridRowHeight(2000, 200, 5)).toBe(128);
  });
  it('three event lanes from 112 px, two below', () => {
    expect(lanesForRow(128)).toBe(3);
    expect(lanesForRow(112)).toBe(3);
    expect(lanesForRow(111)).toBe(2);
    expect(lanesForRow(88)).toBe(2);
  });
});
