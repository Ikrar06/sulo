import { describe, expect, it } from 'vitest';
import { HEAD_P_RANGE, HEAD_Q_RANGE, HEAD_SMALL_SCALE, headProgress } from '../src/shell/head-progress';

describe('header progress (follows the finger)', () => {
  it('0 at the top and 1 once the large row has scrolled away', () => {
    expect(headProgress(0, HEAD_P_RANGE)).toBe(0);
    expect(headProgress(56, HEAD_P_RANGE)).toBe(1);
    expect(headProgress(400, HEAD_P_RANGE)).toBe(1);
  });
  it('in between, proportional to the distance', () => {
    expect(headProgress(28, HEAD_P_RANGE)).toBe(0.5);
    expect(headProgress(14, HEAD_P_RANGE)).toBe(0.25);
  });
  it('overscroll above the top never makes the title larger', () => {
    expect(headProgress(-40, HEAD_P_RANGE)).toBe(0);
    expect(1 - headProgress(-40, HEAD_P_RANGE) * (1 - HEAD_SMALL_SCALE)).toBe(1);
  });
  it("Ringkasan's small title over 72-120 px", () => {
    expect(headProgress(72, HEAD_Q_RANGE)).toBe(0);
    expect(headProgress(96, HEAD_Q_RANGE)).toBe(0.5);
    expect(headProgress(120, HEAD_Q_RANGE)).toBe(1);
  });
  it('a broken value is the top', () => {
    expect(headProgress(Number.NaN, HEAD_P_RANGE)).toBe(0);
  });
});
