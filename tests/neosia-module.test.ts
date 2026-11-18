import { describe, expect, it } from 'vitest';
import { wipeAllData } from '../lib/account/actions';
import {
  disableModule,
  enableModule,
  NEOSIA_MODULE_KEY,
  NEOSIA_PERMISSIONS,
  NEOSIA_SCRIPTS,
  readModuleState,
  reconcileModule,
  type ModuleDeps,
  type RegisteredScript,
  type ScriptingApi,
} from '../lib/neosia/module';
import { memoryStore } from './helpers';

const NOW = 1_794_000_000;

function fakeBrowser(initial: { granted?: boolean; scripts?: string[]; failRegister?: boolean } = {}) {
  let granted = initial.granted ?? true;
  let registered = new Map<string, RegisteredScript>((initial.scripts ?? []).map((id) => [id, { id } as RegisteredScript]));
  const calls: string[] = [];
  const api: ScriptingApi = {
    registerContentScripts: async (scripts) => {
      calls.push(`register:${scripts.map((s) => s.id).join(',')}`);
      if (initial.failRegister) {
        registered = new Map([...registered, [scripts[0]!.id, scripts[0]!]]);
        throw new Error('boom');
      }
      registered = new Map([...registered, ...scripts.map((s) => [s.id, s] as const)]);
    },
    unregisterContentScripts: async ({ ids }) => {
      calls.push(`unregister:${ids.join(',')}`);
      registered = new Map([...registered].filter(([id]) => !ids.includes(id)));
    },
    getRegisteredContentScripts: async ({ ids }) => [...registered.values()].filter((s) => ids.includes(s.id)).map((s) => ({ id: s.id })),
  };
  return {
    calls,
    registered: () => [...registered.values()],
    revoke: () => void (granted = false),
    deps: (store = memoryStore()): ModuleDeps => ({
      store,
      now: () => NOW,
      hasPermissions: async () => granted,
      removePermissions: async () => {
        calls.push('removePermissions');
        granted = false;
      },
      // chrome.scripting disappears with the "scripting" permission.
      scripting: () => (granted ? api : null),
    }),
  };
}

describe('NEOSIA permissions and scripts', () => {
  it('asks for scripting and both NEOSIA hosts together, nothing else', () => {
    expect(NEOSIA_PERMISSIONS).toEqual({ permissions: ['scripting'], origins: ['https://neosia.unhas.ac.id/*', 'https://api.neosia.unhas.ac.id/*'] });
  });

  it('registers a page-world script and an isolated bridge, both at document_start and only on the NEOSIA app', () => {
    expect(NEOSIA_SCRIPTS.map((s) => [s.world, s.runAt, s.matches])).toEqual([
      ['MAIN', 'document_start', ['https://neosia.unhas.ac.id/*']],
      ['ISOLATED', 'document_start', ['https://neosia.unhas.ac.id/*']],
    ]);
    expect(NEOSIA_SCRIPTS.every((s) => !s.matches.some((m) => m.includes('api.')))).toBe(true);
  });
});

describe('turning the module on', () => {
  it('is off by default', async () => {
    expect(await readModuleState(memoryStore())).toEqual({ enabled: false, changedAt: null });
  });

  it('registers both scripts and marks the module on once the permissions are granted', async () => {
    const b = fakeBrowser();
    const store = memoryStore();
    expect(await enableModule(b.deps(store))).toBe('enabled');
    expect(b.registered().map((s) => s.id)).toEqual(['sulo-neosia-main', 'sulo-neosia-bridge']);
    expect(await readModuleState(store)).toEqual({ enabled: true, changedAt: NOW });
  });

  it('changes nothing when the permission was refused', async () => {
    const b = fakeBrowser({ granted: false });
    const store = memoryStore();
    expect(await enableModule(b.deps(store))).toBe('no_permission');
    expect(b.registered()).toEqual([]);
    expect(store.dump()[NEOSIA_MODULE_KEY]).toBeUndefined();
  });

  it('undoes half a registration and stays off', async () => {
    const b = fakeBrowser({ failRegister: true });
    const store = memoryStore();
    expect(await enableModule(b.deps(store))).toBe('failed');
    expect(b.registered()).toEqual([]);
    expect((await readModuleState(store)).enabled).toBe(false);
  });
});

describe('turning the module off', () => {
  it('unregisters the scripts, removes the permissions and deletes every NEOSIA key', async () => {
    const b = fakeBrowser();
    const store = memoryStore({ 'neosia:snap:dashboard': { at: 1 }, 'neosia:courseMap': {}, 'u:1:tasks': [], 'global:prefs': {} });
    await enableModule(b.deps(store));
    await disableModule(b.deps(store));
    expect(b.registered()).toEqual([]);
    expect(b.calls).toContain('removePermissions');
    expect(Object.keys(store.dump()).sort()).toEqual([NEOSIA_MODULE_KEY, 'global:prefs', 'u:1:tasks']);
    expect(await readModuleState(store)).toEqual({ enabled: false, changedAt: NOW });
  });

  it('"Hapus semua data" turns the module off before clearing storage', async () => {
    const b = fakeBrowser();
    const store = memoryStore();
    await enableModule(b.deps(store));
    const order: string[] = [];
    await wipeAllData({
      syncRunning: async () => false,
      sleep: async () => {},
      clearAlarms: async () => void order.push('alarms'),
      beforeClear: async () => {
        order.push('neosia');
        await disableModule(b.deps(store));
      },
      clearNotifications: async () => void order.push('notifications'),
      clearLocal: async () => void order.push('local'),
      clearSession: async () => void order.push('session'),
      ensureAlarms: async () => {},
      openSetup: async () => {},
    });
    expect(order.indexOf('neosia')).toBeLessThan(order.indexOf('local'));
    expect(b.registered()).toEqual([]);
    expect(b.calls).toContain('removePermissions');
  });
});

describe('startup and a removed permission', () => {
  it('turns the module off and deletes its data when a permission is gone', async () => {
    const b = fakeBrowser();
    const store = memoryStore({ 'neosia:snap:max_sks': { at: 1 } });
    await enableModule(b.deps(store));
    b.revoke();
    expect(await reconcileModule(b.deps(store))).toBe('turned_off');
    expect(store.dump()['neosia:snap:max_sks']).toBeUndefined();
    expect((await readModuleState(store)).enabled).toBe(false);
  });

  it('keeps an intact module as it is', async () => {
    const b = fakeBrowser();
    const store = memoryStore();
    await enableModule(b.deps(store));
    const before = b.calls.length;
    expect(await reconcileModule(b.deps(store))).toBe('on');
    expect(b.calls.length).toBe(before);
  });

  it('registers scripts the browser dropped again', async () => {
    const b = fakeBrowser();
    const store = memoryStore({ [NEOSIA_MODULE_KEY]: { enabled: true, changedAt: 1 } });
    expect(await reconcileModule(b.deps(store))).toBe('reregistered');
    expect(b.registered()).toHaveLength(2);
  });

  it('removes scripts left behind while the module is off', async () => {
    const b = fakeBrowser({ scripts: ['sulo-neosia-main'] });
    expect(await reconcileModule(b.deps())).toBe('off');
    expect(b.registered()).toEqual([]);
  });
});
