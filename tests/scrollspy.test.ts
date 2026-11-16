import { describe, expect, it } from 'vitest';
import { getActiveSection, SCROLLSPY_OFFSET } from '../lib/ui/scrollspy';

// Sections at 0, 600, 1400 and 1500 px in a 2000 px page, 800 px window.
const OFFSETS = [0, 600, 1400, 1500];
const VIEW = 800;
const HEIGHT = 2000;

describe('getActiveSection', () => {
  it('starts on the first section at the top', () => {
    expect(getActiveSection(OFFSETS, 0, VIEW, HEIGHT)).toBe(0);
  });

  it('is the last section whose top is at or above scrollTop + 96', () => {
    expect(getActiveSection(OFFSETS, 600 - SCROLLSPY_OFFSET - 1, VIEW, HEIGHT)).toBe(0);
    expect(getActiveSection(OFFSETS, 600 - SCROLLSPY_OFFSET, VIEW, HEIGHT)).toBe(1);
    expect(getActiveSection(OFFSETS, 900, VIEW, HEIGHT)).toBe(1);
  });

  it('two tops in the band: the later one wins', () => {
    expect(getActiveSection(OFFSETS, 1100, VIEW, 3000)).toBe(1);
    expect(getActiveSection(OFFSETS, 1410, VIEW, 3000)).toBe(3);
  });

  it('at the bottom the last section is active, even when its top never reaches the band', () => {
    // Max scroll is 1200: section 3 at 1500 is below 1200 + 96, but it is the end of the page.
    expect(getActiveSection(OFFSETS, HEIGHT - VIEW, VIEW, HEIGHT)).toBe(3);
    // Within 2 px of the bottom counts (fractional scroll positions).
    expect(getActiveSection(OFFSETS, HEIGHT - VIEW - 2, VIEW, HEIGHT)).toBe(3);
    expect(getActiveSection(OFFSETS, HEIGHT - VIEW - 3, VIEW, HEIGHT)).toBe(1);
  });

  it('a page shorter than the window is always at the bottom: the last section', () => {
    expect(getActiveSection([0, 200, 400], 0, VIEW, 700)).toBe(2);
  });

  it('no sections: -1', () => {
    expect(getActiveSection([], 0, VIEW, HEIGHT)).toBe(-1);
  });

  it('sections above the first top (negative offsets) still count', () => {
    expect(getActiveSection([-20, 300], 0, VIEW, HEIGHT)).toBe(0);
  });
});
