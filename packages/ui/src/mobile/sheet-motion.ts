// Motion rules for the bottom sheet (sheet.tsx), kept free of React and the
// DOM so they can be tested: when a drag dismisses, how long the rest of the
// way takes, which sheet the Android back button closes, and the work that
// waits until a closing sheet has left the screen.

/** Closing: 200 ms, a smooth ease-in, faster than the 240 ms opening; no bounce. */
export const CLOSE_MS = 200;
export const CLOSE_EASE = 'cubic-bezier(0.4, 0, 1, 1)';
/** Reduced motion: no sliding, opacity only. */
export const REDUCED_MS = 120;
/** Extra time before the guard unmounts a sheet whose animationend never came. */
export const GUARD_MS = 150;
/** A drag past this share of the sheet's height dismisses it. */
export const DRAG_SHARE = 0.3;
/** Or a flick down this fast (px per ms), once it has moved a little. */
export const FLICK_SPEED = 0.5;
export const FLICK_MIN_PX = 16;
/** Movement before a touch counts as a drag. */
export const DRAG_SLOP_PX = 6;

export type DragEnd = { close: true; durationMs: number } | { close: false };

/**
 * Where a released drag goes. Closing continues at the release speed
 * (linear, so the sheet keeps the finger's pace) and never takes longer than
 * the usual close; a slow release takes the usual 200 ms.
 */
export function dragEnd(offsetPx: number, speedPxPerMs: number, heightPx: number, exitPx: number): DragEnd {
  const past = offsetPx > heightPx * DRAG_SHARE;
  const flick = speedPxPerMs > FLICK_SPEED && offsetPx > FLICK_MIN_PX;
  if (!past && !flick) return { close: false };
  const remaining = Math.max(0, exitPx - offsetPx);
  const speed = Math.max(speedPxPerMs, remaining / CLOSE_MS);
  return { close: true, durationMs: Math.round(Math.min(CLOSE_MS, Math.max(80, remaining / Math.max(speed, 0.001)))) };
}

/** Release speed from the last samples (px per ms, down positive), over at most the last 80 ms. */
export function releaseSpeed(samples: readonly { t: number; y: number }[]): number {
  const last = samples.at(-1);
  if (!last) return 0;
  const first = samples.find((s) => last.t - s.t <= 80) ?? last;
  const dt = last.t - first.t;
  return dt > 0 ? (last.y - first.y) / dt : 0;
}

// The open sheets, newest last: the Android back button closes the top one.
const stack: { id: number; close: () => void }[] = [];
let nextId = 1;

/** Registers an open sheet; returns the function that removes it. */
export function pushSheet(close: () => void): () => void {
  const id = nextId++;
  stack.push({ id, close });
  return () => {
    const i = stack.findIndex((s) => s.id === id);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** Closes the newest open sheet (same animation as a tap on the scrim); false when none is open. */
export function closeTopSheet(): boolean {
  const top = stack.at(-1);
  if (!top) return false;
  top.close();
  return true;
}

export function openSheetCount(): number {
  return stack.length;
}

// Work that waits for a closing sheet to leave the screen (saving, a toast,
// a heavy re-render, opening the next sheet).
const waiting: (() => void)[] = [];
let closing = 0;
let guard: ReturnType<typeof setTimeout> | null = null;

function flush() {
  if (guard !== null) clearTimeout(guard);
  guard = null;
  const run = waiting.splice(0);
  for (const fn of run) {
    try {
      fn();
    } catch (e) {
      // One failing step must not keep the others from running.
      console.error('sheet: after-close step failed', e);
    }
  }
}

/**
 * Runs `fn` once the sheet now closing is gone (its exit animation ended,
 * then one frame). Call it in the same handler that closes the sheet. A
 * guard runs it anyway if no sheet ends up closing.
 */
export function afterSheetClosed(fn: () => void, guardMs = CLOSE_MS + GUARD_MS): void {
  waiting.push(fn);
  if (guard === null) guard = setTimeout(flush, guardMs);
}

/**
 * Runs every waiting callback now (the app is going to the background, where
 * Android may end the process before a sheet finishes closing).
 */
export function flushSheetWork(): void {
  if (waiting.length > 0) flush();
}

/** A sheet started its exit. */
export function sheetClosing(): void {
  closing += 1;
}

/** A sheet finished its exit (and was unmounted); waiting work runs when none is still closing. */
export function sheetClosed(): void {
  closing = Math.max(0, closing - 1);
  if (closing === 0 && waiting.length > 0) flush();
}

/** Tests only. */
export function resetSheetMotion(): void {
  stack.splice(0);
  waiting.splice(0);
  closing = 0;
  if (guard !== null) clearTimeout(guard);
  guard = null;
}
