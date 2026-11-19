import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLOSE_MS, GUARD_MS, afterSheetClosed, closeTopSheet, dragEnd, openSheetCount, pushSheet, releaseSpeed, resetSheetMotion, sheetClosed, sheetClosing } from '@sulo/ui/mobile/sheet-motion';

afterEach(() => {
  resetSheetMotion();
  vi.useRealTimers();
});

describe('drag to dismiss', () => {
  it('snaps back when released early and slowly', () => {
    expect(dragEnd(60, 0.1, 400, 800)).toEqual({ close: false });
    // A fast flick that barely moved is not a dismissal either.
    expect(dragEnd(10, 2, 400, 800)).toEqual({ close: false });
  });

  it('closes past 30 % of the height, in the usual time when the release was slow', () => {
    expect(dragEnd(130, 0, 400, 800)).toEqual({ close: true, durationMs: CLOSE_MS });
  });

  it('a flick keeps its speed for the rest of the way, never slower than the usual close', () => {
    // 600 px left at 4 px/ms: 150 ms.
    expect(dragEnd(40, 4, 400, 640)).toEqual({ close: true, durationMs: 150 });
    // Very fast: at least 80 ms, so it is still seen leaving.
    expect(dragEnd(40, 50, 400, 640)).toEqual({ close: true, durationMs: 80 });
  });

  it('measures the release speed over the last 80 ms', () => {
    expect(releaseSpeed([])).toBe(0);
    expect(releaseSpeed([{ t: 0, y: 0 }, { t: 100, y: 10 }, { t: 140, y: 50 }, { t: 160, y: 90 }])).toBeCloseTo(80 / 60);
  });
});

describe('the Android back button', () => {
  it('closes the newest open sheet first, then nothing', () => {
    const closed: string[] = [];
    const offA = pushSheet(() => closed.push('a'));
    pushSheet(() => closed.push('b'));
    expect(closeTopSheet()).toBe(true);
    expect(closed).toEqual(['b']);
    offA();
    expect(openSheetCount()).toBe(1);
    resetSheetMotion();
    expect(closeTopSheet()).toBe(false);
  });
});

describe('work after the exit', () => {
  it('waits for the closing sheet, then runs once', () => {
    vi.useFakeTimers();
    const run = vi.fn();
    afterSheetClosed(run);
    sheetClosing();
    vi.advanceTimersByTime(100);
    expect(run).not.toHaveBeenCalled();
    sheetClosed();
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('waits for every sheet still closing', () => {
    const run = vi.fn();
    sheetClosing();
    sheetClosing();
    afterSheetClosed(run);
    sheetClosed();
    expect(run).not.toHaveBeenCalled();
    sheetClosed();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('a guard runs it when no sheet ends up closing', () => {
    vi.useFakeTimers();
    const run = vi.fn();
    afterSheetClosed(run);
    vi.advanceTimersByTime(CLOSE_MS + GUARD_MS);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('one failing step does not stop the others', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const run = vi.fn();
    sheetClosing();
    afterSheetClosed(() => {
      throw new Error('x');
    });
    afterSheetClosed(run);
    sheetClosed();
    expect(run).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });
});
