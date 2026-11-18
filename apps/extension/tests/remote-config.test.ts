import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REMOTE_CONFIG,
  REMOTE_CONFIG_KEY,
  effectiveIntervalMinutes,
  readRemoteConfig,
  refreshRemoteConfig,
} from '@sulo/core/remote/remote-config';
import { fakeFetch, fixedClock, jsonResponse, memoryStore } from './helpers';

const NOW = 1_794_000_000;
// Must be on the sulo-data domain: the scheduler refuses any other origin.
const URL_ = 'https://ikrar06.github.io/sulo-data/config.json';
const clock = fixedClock('2026-11-13', 10, NOW);

describe('remote config', () => {
  it('uses the default (enabled) when nothing is stored', async () => {
    expect(await readRemoteConfig(memoryStore())).toEqual(DEFAULT_REMOTE_CONFIG);
  });

  it('skips fetching entirely when the URL is empty', async () => {
    const fetch = fakeFetch(() => jsonResponse({}));
    await refreshRemoteConfig({ fetch, store: memoryStore(), clock, url: '' });
    expect(fetch.calls).toHaveLength(0);
  });

  it('stores a valid config without credentials', async () => {
    const store = memoryStore();
    const fetch = fakeFetch(() => jsonResponse({ enabled: false, minIntervalMinutes: 240, message: 'Jeda' }));
    const result = await refreshRemoteConfig({ fetch, store, clock, url: URL_ });
    expect(result).toEqual({ enabled: false, minIntervalMinutes: 240, message: 'Jeda', fetchedAt: NOW });
    expect(fetch.calls[0]?.init?.credentials).toBe('omit');
    expect(store.dump()[REMOTE_CONFIG_KEY]).toEqual(result);
  });

  it('fetches at most once per 24 hours', async () => {
    const store = memoryStore({ [REMOTE_CONFIG_KEY]: { ...DEFAULT_REMOTE_CONFIG, fetchedAt: NOW - 3600 } });
    const fetch = fakeFetch(() => jsonResponse({ enabled: false, minIntervalMinutes: 180 }));
    await refreshRemoteConfig({ fetch, store, clock, url: URL_ });
    expect(fetch.calls).toHaveLength(0);
  });

  it('keeps the last stored value when the fetch fails or the content is invalid', async () => {
    const stored = { enabled: false, minIntervalMinutes: 300, message: 'lama', fetchedAt: NOW - 2 * 86_400 };
    for (const respond of [
      () => new Response('', { status: 500 }),
      () => jsonResponse({ enabled: 'yes' }),
      () => jsonResponse({ enabled: true, minIntervalMinutes: 180, run: 'alert(1)' }),
    ]) {
      const store = memoryStore({ [REMOTE_CONFIG_KEY]: stored });
      const result = await refreshRemoteConfig({ fetch: fakeFetch(respond), store, clock, url: URL_ });
      if (respond.toString().includes('alert')) {
        // Unknown keys are dropped; only data fields survive.
        expect(result).toEqual({ enabled: true, minIntervalMinutes: 180, message: '', fetchedAt: NOW });
      } else {
        expect(result).toEqual({ ...stored, fetchedAt: NOW });
      }
    }
  });

  it('can only slow background sync down', () => {
    expect(effectiveIntervalMinutes({ ...DEFAULT_REMOTE_CONFIG, minIntervalMinutes: 30 })).toBe(180);
    expect(effectiveIntervalMinutes({ ...DEFAULT_REMOTE_CONFIG, minIntervalMinutes: 600 })).toBe(600);
  });
});
