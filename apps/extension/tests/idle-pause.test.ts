import { describe, expect, it } from 'vitest';
import { IDLE_PAUSE_KEY, idleTooLong, LAST_OPEN_KEY, markOpened, pauseIfIdle } from '@sulo/core/watch/idle';
import { memoryStore } from './helpers';

const DAY = 86_400;

describe('7 days without opening Sulo', () => {
  it('counts exactly 7 days, not 6 days 23 hours, and never before a first open', () => {
    expect(idleTooLong(0, 7 * DAY)).toBe(true);
    expect(idleTooLong(0, 7 * DAY - 3600)).toBe(false);
    expect(idleTooLong(null, 100 * DAY)).toBe(false);
  });

  it('pauses once, and an open on day 6 starts the count again', async () => {
    const store = memoryStore();
    await markOpened(store, 0);
    expect(await pauseIfIdle(store, 6 * DAY)).toBe(false);
    await markOpened(store, 6 * DAY);
    expect(await pauseIfIdle(store, 12 * DAY)).toBe(false);
    expect(await pauseIfIdle(store, 13 * DAY)).toBe(true);
    expect(await pauseIfIdle(store, 14 * DAY)).toBe(false);
    expect(store.dump()[IDLE_PAUSE_KEY]).toBe(13 * DAY);
  });

  it('opening ends the pause and moves the marker', async () => {
    const store = memoryStore({ [LAST_OPEN_KEY]: 0, [IDLE_PAUSE_KEY]: 8 * DAY });
    expect(await markOpened(store, 9 * DAY)).toBe(0);
    expect(store.dump()[IDLE_PAUSE_KEY]).toBeUndefined();
    expect(store.dump()[LAST_OPEN_KEY]).toBe(9 * DAY);
  });
});
