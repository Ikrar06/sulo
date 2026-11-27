import { describe, expect, it } from 'vitest';
import { dragEnd } from '@sulo/ui/mobile/sheet-motion';
import { EDGE_PX, edgeDirection, edgeStarts, LOCK_PX } from '../src/shell/edge-back';

describe('the iPhone swipe back from the left edge', () => {
  it('starts only at the edge, and never with a sheet open', () => {
    expect(edgeStarts(0, 0)).toBe(true);
    expect(edgeStarts(EDGE_PX, 0)).toBe(true);
    expect(edgeStarts(EDGE_PX + 1, 0)).toBe(false);
    expect(edgeStarts(4, 1)).toBe(false);
  });
  it('claims a sideways move to the right, and leaves up, down and left to the page', () => {
    expect(edgeDirection(LOCK_PX - 1, 2)).toBeNull();
    expect(edgeDirection(LOCK_PX + 2, 3)).toBe('back');
    expect(edgeDirection(4, LOCK_PX + 6)).toBe('page');
    expect(edgeDirection(-LOCK_PX - 2, 0)).toBe('page');
    // A diagonal that is more down than across scrolls the page.
    expect(edgeDirection(12, 14)).toBe('page');
  });
  it('goes back past 30% of the width or on a flick, like dragging a sheet down', () => {
    const width = 390;
    expect(dragEnd(width * 0.35, 0.1, width, width)).toMatchObject({ close: true });
    expect(dragEnd(width * 0.2, 0.1, width, width)).toEqual({ close: false });
    expect(dragEnd(40, 0.9, width, width)).toMatchObject({ close: true });
  });
});
