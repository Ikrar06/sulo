import { beforeEach, describe, expect, it, vi } from 'vitest';

// On the phone, writes go to SuloStore (commit, on disk before done). On Android reads stay
// with Preferences; on iOS they go to SuloStore too, whose files are kept out of backups.
const written: string[] = [];
const memory = new Map<string, string>();
const platform = { name: 'android' };
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => platform.name },
  registerPlugin: () => ({
    set: async (o: { key: string; value: string }) => void (written.push(`set ${o.key}`), memory.set(o.key, o.value)),
    remove: async (o: { key: string }) => void (written.push(`remove ${o.key}`), memory.delete(o.key)),
    get: async (o: { key: string }) => (written.push(`get ${o.key}`), { value: memory.get(o.key) ?? null }),
    keys: async () => (written.push('keys'), { keys: [...memory.keys()] }),
  }),
}));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => {
      if (platform.name === 'ios') throw new Error('Preferences.get must not be used on iOS');
      return { value: memory.get(key) ?? null };
    },
    set: async () => {
      throw new Error('Preferences.set must not be used on the phone');
    },
    remove: async () => {
      throw new Error('Preferences.remove must not be used on the phone');
    },
    keys: async () => {
      if (platform.name === 'ios') throw new Error('Preferences.keys must not be used on iOS');
      return { keys: [...memory.keys()] };
    },
  },
}));

const { createPreferencesStore } = await import('../src/platform/store');

beforeEach(() => {
  written.length = 0;
  memory.clear();
});

describe('the store on the phone writes through SuloStore', () => {
  it('Android: set and remove go native; reads stay with Preferences, same file', async () => {
    platform.name = 'android';
    const store = createPreferencesStore();
    await store.set('global:session', { state: 'OK' });
    expect(await store.get('global:session')).toEqual({ state: 'OK' });
    await store.remove('global:session');
    expect(written).toEqual(['set sulo:global:session', 'remove sulo:global:session']);
    expect(await store.get('global:session')).toBeUndefined();
  });

  it('iOS: reads and key listings go through SuloStore as well', async () => {
    platform.name = 'ios';
    const store = createPreferencesStore();
    await store.set('global:session', { state: 'OK' });
    expect(await store.get('global:session')).toEqual({ state: 'OK' });
    expect(await store.keys('global:')).toEqual(['global:session']);
    expect(written).toContain('get sulo:global:session');
    expect(written).toContain('keys');
  });
});
