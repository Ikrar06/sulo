import { describe, expect, it, vi } from 'vitest';

// On the phone, writes go to SuloStore (commit, on disk before done); reads stay with Preferences.
const written: string[] = [];
const memory = new Map<string, string>();
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => ({
    set: async (o: { key: string; value: string }) => void (written.push(`set ${o.key}`), memory.set(o.key, o.value)),
    remove: async (o: { key: string }) => void (written.push(`remove ${o.key}`), memory.delete(o.key)),
  }),
}));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: memory.get(key) ?? null }),
    set: async () => {
      throw new Error('Preferences.set must not be used on the phone');
    },
    remove: async () => {
      throw new Error('Preferences.remove must not be used on the phone');
    },
    keys: async () => ({ keys: [...memory.keys()] }),
  },
}));

const { createPreferencesStore } = await import('../src/platform/store');

describe('the store on the phone writes through SuloStore', () => {
  it('set and remove go native; get reads the same file', async () => {
    const store = createPreferencesStore();
    await store.set('global:session', { state: 'OK' });
    expect(await store.get('global:session')).toEqual({ state: 'OK' });
    await store.remove('global:session');
    expect(written).toEqual(['set sulo:global:session', 'remove sulo:global:session']);
    expect(await store.get('global:session')).toBeUndefined();
  });
});
