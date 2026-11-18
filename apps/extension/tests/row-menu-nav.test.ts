import { describe, expect, it } from 'vitest';
import { rowMenuNav } from '../components/popup/row-menu-nav';

describe('task menu drill-down', () => {
  it('opens on the main view, even if it was left on the snooze view', () => {
    expect(rowMenuNav('snooze', { type: 'open' })).toEqual({ view: 'main', effect: 'none' });
  });

  it('enters the snooze view by selecting the item (click, Enter, Space) and stays open', () => {
    expect(rowMenuNav('main', { type: 'enterSnooze' })).toEqual({ view: 'snooze', effect: 'keepOpen' });
  });

  it('enters with ArrowRight only from the snooze item', () => {
    expect(rowMenuNav('main', { type: 'key', key: 'ArrowRight', onSnoozeItem: true })).toEqual({ view: 'snooze', effect: 'keepOpen' });
    expect(rowMenuNav('main', { type: 'key', key: 'ArrowRight', onSnoozeItem: false })).toEqual({ view: 'main', effect: 'none' });
  });

  it('goes back with ArrowLeft, Escape or the back item, without closing', () => {
    expect(rowMenuNav('snooze', { type: 'key', key: 'ArrowLeft', onSnoozeItem: false })).toEqual({ view: 'main', effect: 'keepOpen' });
    expect(rowMenuNav('snooze', { type: 'key', key: 'Escape', onSnoozeItem: false })).toEqual({ view: 'main', effect: 'keepOpen' });
    expect(rowMenuNav('snooze', { type: 'back' })).toEqual({ view: 'main', effect: 'keepOpen' });
  });

  it('closes on a second Escape from the main view', () => {
    const first = rowMenuNav('snooze', { type: 'key', key: 'Escape', onSnoozeItem: false });
    expect(rowMenuNav(first.view, { type: 'key', key: 'Escape', onSnoozeItem: false })).toEqual({ view: 'main', effect: 'close' });
  });

  it('leaves arrow up and down to the menu itself', () => {
    expect(rowMenuNav('snooze', { type: 'key', key: 'ArrowDown', onSnoozeItem: false })).toEqual({ view: 'snooze', effect: 'none' });
  });
});
