import { describe, expect, it } from 'vitest';
import { captureFrom, REFRESH_TAB_KEY, startRefresh } from '@sulo/core/neosia/refresh-tab';
import { memoryStore } from './helpers';

describe('Perbarui dari NEOSIA (extension)', () => {
  it('closes only the tab it opened, once, after its data came in', async () => {
    const session = memoryStore();
    expect(await startRefresh(session, async () => 7, 100)).toBe(true);
    expect(await captureFrom(session, 8, 105)).toBe(false);
    expect(await captureFrom(session, 7, 105)).toBe(true);
    expect(await captureFrom(session, 7, 106)).toBe(false);
  });

  it('stops watching after 30 seconds without data, leaving the tab', async () => {
    const session = memoryStore();
    await startRefresh(session, async () => 7, 100);
    expect(await captureFrom(session, 7, 131)).toBe(false);
    expect(session.dump()[REFRESH_TAB_KEY]).toBeUndefined();
  });

  it('tracks nothing when no tab could open', async () => {
    const session = memoryStore();
    expect(await startRefresh(session, async () => undefined, 100)).toBe(false);
    expect(await captureFrom(session, 7, 101)).toBe(false);
  });
});
