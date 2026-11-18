// Which section a table of contents marks as current. Pure; the caller
// measures offsets relative to the scroll container's content top.

/** A section counts as reached once its top is within this many pixels below the scroll position. */
export const SCROLLSPY_OFFSET = 96;
/** Slack for rounding when deciding the container is scrolled to the bottom. */
const BOTTOM_SLACK = 2;

/**
 * The index of the active section: the last one whose top is at or above
 * `scrollTop + 96`. Scrolled to the bottom, the last section wins, so a
 * short final section can still become active; a page shorter than the
 * screen is always at the bottom. Returns -1 when there are no sections.
 */
export function getActiveSection(offsets: readonly number[], scrollTop: number, viewportHeight: number, scrollHeight: number): number {
  if (offsets.length === 0) return -1;
  if (scrollTop + viewportHeight >= scrollHeight - BOTTOM_SLACK) return offsets.length - 1;
  let active = 0;
  for (let i = 0; i < offsets.length; i++) {
    if (offsets[i]! <= scrollTop + SCROLLSPY_OFFSET) active = i;
  }
  return active;
}
