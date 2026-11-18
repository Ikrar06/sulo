// The NEOSIA module's life cycle (M7). Off by default; on only through the
// consent dialog. Pure: the browser APIs are injected, so the order of the
// steps is tested in Vitest (tests/neosia-module.test.ts).
//
// - The dashboard asks Chrome for the optional permissions inside the click
//   on "Hubungkan" (chrome.permissions.request needs a user gesture), then
//   tells the service worker, which registers the two content scripts.
// - Off: scripts unregistered, permissions removed, every NEOSIA key deleted.
// - At startup and when Chrome reports a removed permission: if the module
//   is on but a permission is gone, it turns itself off and deletes its data.
//
// The extension never sends a request to NEOSIA (project rule 12): the
// scripts only read responses the NEOSIA app already asked for.

import type { KeyValueStore, UnixSeconds } from '../types';
import { NEOSIA_APP_MATCH, NEOSIA_HOST_PERMISSIONS } from './allowlist';

export const NEOSIA_MODULE_KEY = 'global:neosia';
/** Every NEOSIA data key starts with this (snapshots, course map, dev observations). */
export const NEOSIA_DATA_PREFIX = 'neosia:';

/** What chrome.permissions.request/contains/remove take, for the whole module. */
export const NEOSIA_PERMISSIONS = {
  permissions: ['scripting'],
  origins: [...NEOSIA_HOST_PERMISSIONS],
} as const;

export const MAIN_SCRIPT_ID = 'sulo-neosia-main';
export const BRIDGE_SCRIPT_ID = 'sulo-neosia-bridge';

/** Built by WXT as unlisted scripts (entrypoints/neosia-main.ts, neosia-bridge.ts). */
export const MAIN_SCRIPT_FILE = 'neosia-main.js';
export const BRIDGE_SCRIPT_FILE = 'neosia-bridge.js';

export interface NeosiaModuleState {
  enabled: boolean;
  /** When the module was last turned on or off. */
  changedAt: UnixSeconds | null;
}

export const DEFAULT_MODULE_STATE: NeosiaModuleState = { enabled: false, changedAt: null };

export interface RegisteredScript {
  id: string;
  matches: string[];
  js: string[];
  runAt: 'document_start';
  world: 'MAIN' | 'ISOLATED';
  allFrames: false;
  persistAcrossSessions: true;
}

/** Both scripts, only on the NEOSIA app's own pages, before the app's first request. */
export const NEOSIA_SCRIPTS: readonly RegisteredScript[] = [
  { id: MAIN_SCRIPT_ID, matches: [NEOSIA_APP_MATCH], js: [MAIN_SCRIPT_FILE], runAt: 'document_start', world: 'MAIN', allFrames: false, persistAcrossSessions: true },
  { id: BRIDGE_SCRIPT_ID, matches: [NEOSIA_APP_MATCH], js: [BRIDGE_SCRIPT_FILE], runAt: 'document_start', world: 'ISOLATED', allFrames: false, persistAcrossSessions: true },
];

const SCRIPT_IDS = NEOSIA_SCRIPTS.map((s) => s.id);

export interface ModuleDeps {
  store: KeyValueStore;
  now: () => UnixSeconds;
  /** chrome.permissions.contains(NEOSIA_PERMISSIONS). */
  hasPermissions: () => Promise<boolean>;
  /** chrome.permissions.remove(NEOSIA_PERMISSIONS). */
  removePermissions: () => Promise<void>;
  /**
   * chrome.scripting, read lazily: it exists only while the optional
   * "scripting" permission is granted.
   */
  scripting: () => ScriptingApi | null;
}

export interface ScriptingApi {
  registerContentScripts(scripts: RegisteredScript[]): Promise<void>;
  unregisterContentScripts(filter: { ids: string[] }): Promise<void>;
  getRegisteredContentScripts(filter: { ids: string[] }): Promise<{ id: string }[]>;
}

export async function readModuleState(store: KeyValueStore): Promise<NeosiaModuleState> {
  const raw = await store.get<NeosiaModuleState>(NEOSIA_MODULE_KEY);
  return raw && typeof raw.enabled === 'boolean' ? { enabled: raw.enabled, changedAt: raw.changedAt ?? null } : DEFAULT_MODULE_STATE;
}

/** Deletes every NEOSIA data key. The module state itself stays (callers set it). */
export async function wipeNeosiaData(store: KeyValueStore): Promise<void> {
  const keys = await store.keys(NEOSIA_DATA_PREFIX);
  if (keys.length > 0) await store.remove(keys);
}

async function unregisterAll(api: ScriptingApi | null): Promise<void> {
  if (!api) return;
  const present = await api.getRegisteredContentScripts({ ids: SCRIPT_IDS }).catch(() => []);
  if (present.length > 0) await api.unregisterContentScripts({ ids: present.map((s) => s.id) });
}

export type EnableResult = 'enabled' | 'no_permission' | 'failed';

/**
 * After the dashboard got the permissions: registers both scripts (replacing
 * any left from before) and marks the module on. Without the permissions it
 * changes nothing.
 */
export async function enableModule(deps: ModuleDeps): Promise<EnableResult> {
  if (!(await deps.hasPermissions())) return 'no_permission';
  const api = deps.scripting();
  if (!api) return 'no_permission';
  try {
    await unregisterAll(api);
    await api.registerContentScripts(NEOSIA_SCRIPTS.map((s) => ({ ...s, matches: [...s.matches], js: [...s.js] })));
  } catch {
    // Half a registration is worse than none: undo and stay off.
    await unregisterAll(api).catch(() => undefined);
    return 'failed';
  }
  await deps.store.set<NeosiaModuleState>(NEOSIA_MODULE_KEY, { enabled: true, changedAt: deps.now() });
  return 'enabled';
}

/**
 * "Putuskan dan hapus data", a removed permission, "Hapus semua data" or a
 * new SIKOLA account: scripts off, permissions removed, NEOSIA data deleted.
 * Every step runs even when an earlier one fails.
 */
export async function disableModule(deps: ModuleDeps): Promise<void> {
  await unregisterAll(deps.scripting()).catch(() => undefined);
  await deps.removePermissions().catch(() => undefined);
  await wipeNeosiaData(deps.store);
  await deps.store.set<NeosiaModuleState>(NEOSIA_MODULE_KEY, { enabled: false, changedAt: deps.now() });
}

export type ReconcileResult = 'off' | 'on' | 'turned_off' | 'reregistered';

/**
 * Startup and chrome.permissions.onRemoved. The module is on only while its
 * permissions are: a permission taken away in Chrome's settings turns it off
 * and deletes its data. Scripts missing while everything else is in place
 * (a browser that dropped them) are registered again.
 */
export async function reconcileModule(deps: ModuleDeps): Promise<ReconcileResult> {
  const state = await readModuleState(deps.store);
  if (!state.enabled) {
    // Off: nothing of the module may be left behind.
    await unregisterAll(deps.scripting()).catch(() => undefined);
    return 'off';
  }
  if (!(await deps.hasPermissions())) {
    await disableModule(deps);
    return 'turned_off';
  }
  const api = deps.scripting();
  const present = api ? await api.getRegisteredContentScripts({ ids: SCRIPT_IDS }).catch(() => []) : [];
  if (present.length === SCRIPT_IDS.length) return 'on';
  const result = await enableModule(deps);
  if (result !== 'enabled') {
    await disableModule(deps);
    return 'turned_off';
  }
  return 'reregistered';
}
