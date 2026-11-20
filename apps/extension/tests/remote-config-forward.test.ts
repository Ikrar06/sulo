import { describe, expect, it } from 'vitest';
import { REMOTE_CONFIG_KEY, readRemoteConfig, refreshRemoteConfig } from '@sulo/core/remote/remote-config';
import { fakeFetch, fixedClock, jsonResponse, memoryStore } from './helpers';

// sulo-data's config.json with the phone's keys (branch mobile-keepalive). The
// same test ran against the code of v0.1.0 and of main before it was
// published: unknown keys are dropped by their schema, never rejected.
const NEW_CONFIG = {
  "enabled": true,
  "minIntervalMinutes": 180,
  "message": "",
  "mobile": {
    "backgroundKeepAlive": {
      "enabled": true,
      "dayIntervalMinutes": 20,
      "nightIntervalMinutes": 110,
      "radarEvery": 3
    }
  }
};
const NOW = 1_794_000_000;
const URL_ = 'https://ikrar06.github.io/sulo-data/config.json';

describe('forward compatibility: the config with mobile.backgroundKeepAlive', () => {
  it('is accepted, stored, and keeps every field this build knows', async () => {
    const store = memoryStore();
    const fetch = fakeFetch(() => jsonResponse(NEW_CONFIG));
    const result = await refreshRemoteConfig({ fetch, store, clock: fixedClock('2026-11-13', 10, NOW), url: URL_ });
    expect(result).toMatchObject({ enabled: true, minIntervalMinutes: 180, message: '', fetchedAt: NOW });
    expect(store.dump()[REMOTE_CONFIG_KEY]).toMatchObject({ enabled: true, minIntervalMinutes: 180, message: '' });
    expect((await readRemoteConfig(store)).enabled).toBe(true);
  });
  it('a pause in the new file still pauses this build', async () => {
    const store = memoryStore();
    const fetch = fakeFetch(() => jsonResponse({ ...NEW_CONFIG, enabled: false, message: 'Jeda' }));
    const result = await refreshRemoteConfig({ fetch, store, clock: fixedClock('2026-11-13', 10, NOW), url: URL_ });
    expect(result).toMatchObject({ enabled: false, message: 'Jeda' });
  });
});
