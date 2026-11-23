// A new version on the phone (M8e E3): the notice from the stored config,
// "Nanti" for 3 days, and below a required update the SIKOLA client refuses
// every request (nothing reaches the network).
import { describe, expect, it } from 'vitest';
import { createMoodleClient } from '@sulo/core/moodle/client';
import { REMOTE_CONFIG_KEY } from '@sulo/core/remote/remote-config';
import type { KeyValueStore } from '@sulo/core/types';
import { dismissRelease, INSTALLED_CODE, newerRelease, releaseState, showChecksum, updateRequired } from '../src/release';

function memory(init: Record<string, unknown> = {}): KeyValueStore {
  const data = new Map(Object.entries(init));
  return {
    get: async <T,>(k: string) => data.get(k) as T | undefined,
    set: async (k, v) => void data.set(k, v),
    remove: async (keys) => void (Array.isArray(keys) ? keys : [keys]).forEach((k) => data.delete(k)),
    keys: async (p) => [...data.keys()].filter((k) => k.startsWith(p)),
  };
}
const NOW = 1_800_000_000;
const REL = { versionCode: 906, versionName: '0.9.6', url: 'https://github.com/Ikrar06/sulo/releases/download/v0.9.6/sulo-0.9.6-android.apk', sha256: 'b'.repeat(64) };
const config = (release: unknown) => ({ [REMOTE_CONFIG_KEY]: { enabled: true, minIntervalMinutes: 30, message: '', fetchedAt: NOW, okAt: NOW, mobile: { release } } });

describe('release on the phone', () => {
  it('the SHA-256 line: debug builds and the test phase only, never from 1.0.0 in a release', () => {
    expect(showChecksum(906, false)).toBe(true);
    expect(showChecksum(10000, false)).toBe(false);
    expect(showChecksum(10003, false)).toBe(false);
    expect(showChecksum(10000, true)).toBe(true);
  });
  it('this build reads its own versionCode (0.9.0 = 900)', () => {
    expect(INSTALLED_CODE).toBe(900);
  });
  it('available, then closed for 3 days by Nanti; Tentang still knows', async () => {
    const store = memory(config(REL));
    expect((await releaseState(store, NOW)).kind).toBe('available');
    await dismissRelease(store, 906, NOW);
    expect((await releaseState(store, NOW + 3600)).kind).toBe('none');
    expect((await newerRelease(store))?.versionName).toBe('0.9.6');
    expect((await releaseState(store, NOW + 3 * 86_400)).kind).toBe('available');
  });
  it('a broken or missing section: nothing at all', async () => {
    for (const r of [undefined, { ...REL, url: 'https://evil.example/sulo.apk' }, { ...REL, sha256: 'x' }]) {
      const store = memory(config(r));
      expect((await releaseState(store, NOW)).kind).toBe('none');
      expect(await updateRequired(store, NOW)).toBe(false);
    }
    expect(await updateRequired(memory(), NOW)).toBe(false);
  });
  it('below minVersionCode the SIKOLA client refuses without any request', async () => {
    const store = memory(config({ ...REL, minVersionCode: 905 }));
    expect(await updateRequired(store, NOW)).toBe(true);
    let sent = 0;
    const client = createMoodleClient({
      fetch: async () => ((sent += 1), new Response('[]')),
      store,
      clock: { now: () => NOW },
      baseUrl: 'https://sikola-v2.unhas.ac.id',
      getSesskey: async () => 'x',
      updateRequired: () => updateRequired(store, NOW),
    });
    const out = await client.callBatch([{ methodname: 'core_session_time_remaining', args: {} }], { source: 'manual' });
    expect(out).toMatchObject({ kind: 'refused', reason: 'UPDATE_REQUIRED' });
    expect(sent).toBe(0);
  });
});
