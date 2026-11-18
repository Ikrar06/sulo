import { describe, expect, it } from 'vitest';
import { yAxisRange } from '@sulo/core/grades/axis';

describe('semester GPA chart: adaptive y axis', () => {
  it('all 4.00: at least half a point of range, from 3.50', () => {
    expect(yAxisRange([4, 4, 4])).toEqual({ min: 3.5, max: 4, step: 0.25, ticks: [3.5, 3.75, 4] });
  });
  it('3.8 to 4.0: from 3.50', () => {
    expect(yAxisRange([3.8, 3.95, 4])).toEqual({ min: 3.5, max: 4, step: 0.25, ticks: [3.5, 3.75, 4] });
  });
  it('2.1 to 3.9: from 1.75, lines every 0.5 since the range is over 2', () => {
    expect(yAxisRange([2.1, 3.2, 3.9])).toEqual({ min: 1.75, max: 4, step: 0.5, ticks: [1.75, 2, 2.5, 3, 3.5, 4] });
  });
  it('one point', () => {
    expect(yAxisRange([3.6])).toEqual({ min: 3.25, max: 4, step: 0.25, ticks: [3.25, 3.5, 3.75, 4] });
  });
  it('a zero: never below 0', () => {
    expect(yAxisRange([0, 3])).toEqual({ min: 0, max: 4, step: 0.5, ticks: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4] });
  });
});
