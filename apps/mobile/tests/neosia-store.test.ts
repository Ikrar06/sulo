import { beforeEach, describe, expect, it } from 'vitest';
import { CAPTURE_SCHEMA_VERSION, CAPTURE_TYPE, ENDPOINTS } from '@sulo/core/neosia/allowlist';
import { NEOSIA_MODULE_KEY } from '@sulo/core/neosia/module';
import { projectResponse } from '@sulo/core/neosia/project';
import { readSnapshots } from '@sulo/core/neosia/store';
import type { KeyValueStore } from '@sulo/core/platform';
import { SECRET, SYNTHETIC } from '../../extension/tests/neosia-synthetic';
import { ingestQueued, resetIngest } from '../src/neosia/ingest';
import { createNeosiaStore, type NeosiaNative } from '../src/platform/neosia-store';

function memory(initial: Record<string, unknown> = {}): KeyValueStore & { dump: () => Record<string, unknown> } {
  const m = new Map<string, unknown>(Object.entries(initial));
  return {
    get: async <T>(k: string) => m.get(k) as T | undefined,
    set: async (k, v) => void m.set(k, v),
    remove: async (keys) => void [keys].flat().forEach((k) => m.delete(k)),
    keys: async (start) => [...m.keys()].filter((k) => k.startsWith(start)),
    watch: () => () => undefined,
    dump: () => Object.fromEntries(m),
  };
}

/** The native NeosiaStore: per-account maps (the encryption is native, tested in Kotlin). */
function native(): NeosiaNative & { users: Map<number, Map<string, string>> } {
  const users = new Map<number, Map<string, string>>();
  const of = (u: number) => users.get(u) ?? users.set(u, new Map()).get(u)!;
  return {
    users,
    storeGet: async ({ user, key }) => ({ value: of(user).get(key) ?? null }),
    storeSet: async ({ user, key, value }) => void of(user).set(key, value),
    storeRemove: async ({ user, keys }) => void keys.forEach((k) => of(user).delete(k)),
    storeKeys: async ({ user, prefix }) => ({ keys: [...of(user).keys()].filter((k) => k.startsWith(prefix)) }),
  };
}

const message = (endpoint: 'dashboard', at = 1) => {
  const spec = ENDPOINTS.find((e) => e.id === endpoint)!.spec;
  return JSON.stringify({ type: CAPTURE_TYPE, v: CAPTURE_SCHEMA_VERSION, endpoint, status: 'ok', data: projectResponse(spec, SYNTHETIC[endpoint]).data, at });
};

describe('NEOSIA data on Android (M8d B2)', () => {
  beforeEach(() => resetIngest());

  it('NEOSIA data goes to the encrypted native store of the current account, never the app store', async () => {
    const main = memory({ 'global:currentUser': 7, [NEOSIA_MODULE_KEY]: { enabled: true, changedAt: 1 } });
    const n = native();
    const store = createNeosiaStore(main, n);
    const stored = await ingestQueued({ take: async () => ({ messages: [message('dashboard')] }), store, now: () => 100 });
    expect(stored).toBe(1);
    expect(Object.keys(main.dump()).some((k) => k.startsWith('neosia:'))).toBe(false);
    expect([...n.users.get(7)!.keys()]).toEqual(['neosia:snap:dashboard']);
    expect(Object.keys(await readSnapshots(store))).toEqual(['dashboard']);
    // Another account reads nothing of it.
    await main.set('global:currentUser', 8);
    expect(await readSnapshots(store)).toEqual({});
  });

  it('nothing forbidden survives into the store', async () => {
    const main = memory({ 'global:currentUser': 7, [NEOSIA_MODULE_KEY]: { enabled: true, changedAt: 1 } });
    const n = native();
    await ingestQueued({ take: async () => ({ messages: [message('dashboard')] }), store: createNeosiaStore(main, n), now: () => 100 });
    const text = [...n.users.get(7)!.values()].join('\n');
    for (const v of Object.values(SECRET)) expect(text.includes(String(v))).toBe(false);
  });

  it('the module off, a message that fails the schema, or the same one within 5 seconds: nothing more is stored', async () => {
    const n = native();
    const off = createNeosiaStore(memory({ 'global:currentUser': 7 }), n);
    expect(await ingestQueued({ take: async () => ({ messages: [message('dashboard')] }), store: off, now: () => 100, nowMs: () => 0 })).toBe(0);
    const on = createNeosiaStore(memory({ 'global:currentUser': 7, [NEOSIA_MODULE_KEY]: { enabled: true, changedAt: 1 } }), n);
    const bad = JSON.stringify({ type: CAPTURE_TYPE, v: CAPTURE_SCHEMA_VERSION, endpoint: 'dashboard', status: 'ok', data: { nik: SECRET.nik }, at: 1 });
    expect(await ingestQueued({ take: async () => ({ messages: ['not json', bad] }), store: on, now: () => 100, nowMs: () => 1_000 })).toBe(0);
    expect(await ingestQueued({ take: async () => ({ messages: [message('dashboard'), message('dashboard')] }), store: on, now: () => 100, nowMs: () => 10_000 })).toBe(1);
  });

  it('no current account: nothing is written', async () => {
    const n = native();
    const store = createNeosiaStore(memory({ [NEOSIA_MODULE_KEY]: { enabled: true, changedAt: 1 } }), n);
    await ingestQueued({ take: async () => ({ messages: [message('dashboard')] }), store, now: () => 100 });
    expect(n.users.size).toBe(0);
  });
});
