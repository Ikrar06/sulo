// Navigation inside the task menu "⋯". The snooze choices replace the main
// view in place (drill-down) instead of opening a submenu to the side: the
// popup is 380 px wide and Chrome cannot draw outside it, so a side submenu
// was cut off. Pure, so it is tested without a DOM.

export type RowMenuView = 'main' | 'snooze';

export type RowMenuEvent =
  | { type: 'open' }
  | { type: 'enterSnooze' }
  | { type: 'back' }
  /** A key pressed inside the menu content. */
  | { type: 'key'; key: string; onSnoozeItem: boolean };

export interface RowMenuNav {
  view: RowMenuView;
  /** What the menu should do with the event besides switching views. */
  effect: 'none' | 'close' | 'keepOpen';
}

/**
 * - open: always starts on the main view
 * - Enter (via select) or ArrowRight on "Tunda pengingat": snooze view
 * - ArrowLeft or Escape in the snooze view: back to main (menu stays open)
 * - Escape on the main view: close (Radix returns focus to the "⋯" button)
 */
export function rowMenuNav(view: RowMenuView, event: RowMenuEvent): RowMenuNav {
  switch (event.type) {
    case 'open':
      return { view: 'main', effect: 'none' };
    case 'enterSnooze':
      return { view: 'snooze', effect: 'keepOpen' };
    case 'back':
      return { view: 'main', effect: 'keepOpen' };
    case 'key':
      if (view === 'main' && event.key === 'ArrowRight' && event.onSnoozeItem) return { view: 'snooze', effect: 'keepOpen' };
      if (view === 'snooze' && (event.key === 'ArrowLeft' || event.key === 'Escape')) return { view: 'main', effect: 'keepOpen' };
      if (view === 'main' && event.key === 'Escape') return { view: 'main', effect: 'close' };
      return { view, effect: 'none' };
  }
}
