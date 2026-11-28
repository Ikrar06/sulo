import { describe, expect, it, vi } from 'vitest';

// "Lihat data terakhir" (iPhone, C2): once chosen, nothing is sent anywhere for the rest of the run.
const fetchSpy = vi.fn(async () => new Response('{}'));
vi.stubGlobal('fetch', fetchSpy);

const { enterReadOnly, isReadOnly } = await import('../src/read-only');
const { refreshPublicData } = await import('../src/public-data');
const { createMobilePlatform } = await import('../src/platform');

describe('read-only after a required update', () => {
  it('starts off, and once on, the public data is not fetched', async () => {
    expect(isReadOnly()).toBe(false);
    enterReadOnly();
    expect(isReadOnly()).toBe(true);
    await refreshPublicData(createMobilePlatform(), true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
