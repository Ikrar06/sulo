import { describe, expect, it, vi } from 'vitest';

const prefs = new Map<string, string>();
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => void prefs.set(key, value),
    remove: async ({ key }: { key: string }) => void prefs.delete(key),
    keys: async () => ({ keys: [...prefs.keys()] }),
  },
}));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: { checkPermissions: async () => ({ display: 'granted' }), schedule: async () => undefined, cancel: async () => undefined, getPending: async () => ({ notifications: [] }), addListener: async () => ({ remove: async () => undefined }) } }));

const { createMobilePlatform } = await import('../src/platform');
const { applyTestConfig, clearTestConfig, readTestConfig, testConfigUrlOk } = await import('../src/dev/test-config');
const { readRemoteConfig, REMOTE_CONFIG_KEY } = await import('@sulo/core/remote/remote-config');

const GOOD = 'https://raw.githubusercontent.com/Ikrar06/sulo-data/mobile-keepalive/config.json';
const reply = (body: unknown, ok = true) => (async () => ({ ok, json: async () => (typeof body === 'string' ? JSON.parse(body) : body) })) as unknown as typeof fetch;

describe('test config (debug screen)', () => {
  it('only Sulo data URLs are taken', () => {
    expect(testConfigUrlOk(GOOD)).toBe(true);
    for (const bad of ['http://raw.githubusercontent.com/Ikrar06/sulo-data/main/config.json', 'https://raw.githubusercontent.com/someone/sulo-data/main/config.json', 'https://ikrar06.github.io/sulo-data/config.json', 'https://raw.githubusercontent.com/Ikrar06/sulo-data.evil.com/x', 'https://raw.githubusercontent.com/Ikrar06/sulo-datax/main/config.json', ''])
      expect(testConfigUrlOk(bad)).toBe(false);
  });
  it('a URL outside the prefix is refused and nothing is fetched', async () => {
    const platform = createMobilePlatform();
    const fetcher = vi.fn();
    expect(await applyTestConfig(platform, 'https://example.com/config.json', fetcher as unknown as typeof fetch)).toEqual({ ok: false, reason: 'prefix' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('a broken config is ignored: the official one stays', async () => {
    prefs.clear();
    const platform = createMobilePlatform();
    const official = { enabled: true, minIntervalMinutes: 180, message: '', fetchedAt: 1 };
    await platform.store.set(REMOTE_CONFIG_KEY, official);
    expect(await applyTestConfig(platform, GOOD, reply({ enabled: 'maybe' }))).toEqual({ ok: false, reason: 'schema' });
    expect(await applyTestConfig(platform, GOOD, reply('not json{'))).toMatchObject({ ok: false });
    expect(await applyTestConfig(platform, GOOD, reply({}, false))).toEqual({ ok: false, reason: 'fetch' });
    expect(await readRemoteConfig(platform.store)).toEqual(official);
    expect(await readTestConfig(platform)).toBeNull();
  });
  it('a valid test config applies, is labelled, and goes back to the official one', async () => {
    prefs.clear();
    const platform = createMobilePlatform();
    expect(await applyTestConfig(platform, GOOD, reply({ enabled: false, minIntervalMinutes: 180, message: 'uji', mobile: { backgroundKeepAlive: { enabled: false } } }))).toEqual({ ok: true });
    expect((await readRemoteConfig(platform.store)).enabled).toBe(false);
    expect((await readTestConfig(platform))?.url).toBe(GOOD);
    await clearTestConfig(platform);
    expect(await readTestConfig(platform)).toBeNull();
    expect((await readRemoteConfig(platform.store)).fetchedAt).toBe(0);
  });
});
