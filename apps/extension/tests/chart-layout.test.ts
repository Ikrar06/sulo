import { describe, expect, it } from 'vitest';
import { columnAt, columns, labelPlacements, tooltipPosition } from '@sulo/core/grades/chart-layout';

describe('GPA chart: hover columns', () => {
  const xs = [100, 200, 300];
  it('each point owns a band one x step wide', () => {
    expect(columnAt(100, xs)).toBe(0);
    expect(columnAt(149, xs)).toBe(0);
    expect(columnAt(151, xs)).toBe(1);
    expect(columnAt(340, xs)).toBe(2);
    expect(columns(xs, 60, 340)).toEqual([
      { left: 60, width: 90 },
      { left: 150, width: 100 },
      { left: 250, width: 90 },
    ]);
  });
  it('outside every band the hover resets', () => {
    expect(columnAt(10, xs)).toBeNull();
    expect(columnAt(500, xs)).toBeNull();
    expect(columnAt(5, [])).toBeNull();
    expect(columnAt(999, [50])).toBe(0);
  });
});

describe('GPA chart: the one tooltip', () => {
  const size = { width: 160, height: 28 };
  it('centred above the point, clear of its value label', () => {
    expect(tooltipPosition({ x: 400, y: 100 }, size, 800)).toEqual({ left: 320, top: 42, placement: 'above' });
  });
  it('kept inside the card at the left and right edges', () => {
    expect(tooltipPosition({ x: 20, y: 100 }, size, 800).left).toBe(0);
    expect(tooltipPosition({ x: 790, y: 100 }, size, 800).left).toBe(640);
  });
  it('below the point when there is no room above', () => {
    expect(tooltipPosition({ x: 400, y: 50 }, size, 800)).toEqual({ left: 320, top: 62, placement: 'below' });
  });
});

describe('GPA chart: value labels', () => {
  it('above their points when apart', () => {
    expect(labelPlacements([{ x: 100, y: 50 }, { x: 200, y: 52 }])).toEqual(['above', 'above']);
  });
  it('the lower of two close neighbours moves below', () => {
    expect(labelPlacements([{ x: 100, y: 50 }, { x: 120, y: 58 }])).toEqual(['above', 'below']);
    expect(labelPlacements([{ x: 100, y: 58 }, { x: 120, y: 50 }])).toEqual(['below', 'above']);
  });
});
