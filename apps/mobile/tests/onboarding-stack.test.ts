// The welcome screen's sample task stack (scenes-intro.tsx): as many cards as fit above the mascot, measured.
import { describe, expect, it } from 'vitest';
import { STACK_GAP, stackFit } from '../src/onboarding/scenes-intro';

describe('stackFit', () => {
  it('keeps three cards at 100% text on a usual phone (76 px cards, 252 px above the mascot)', () => {
    expect(stackFit([76, 76, 76, 76], 252, 3)).toEqual({ n: 3, pitch: 76 + STACK_GAP });
  });
  it('shows fewer cards when large text makes them taller, never squeezing the gap', () => {
    expect(stackFit([100, 100, 100, 100], 252, 3)).toEqual({ n: 2, pitch: 100 + STACK_GAP });
    expect(stackFit([150, 150, 150, 150], 252, 3)).toEqual({ n: 1, pitch: 150 + STACK_GAP });
  });
  it('sizes every slot by the tallest card in play, so no card lies over the next', () => {
    expect(stackFit([70, 90, 76, 200], 252, 2).pitch).toBe(90 + STACK_GAP);
  });
  it('always keeps one card', () => {
    expect(stackFit([400, 400], 100, 3).n).toBe(1);
  });
});
