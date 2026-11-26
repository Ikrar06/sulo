// The Sipakamase module's life cycle (1.1.0), the pattern of neosia/module.ts.
// Off by default; on only through the consent dialog. Off means: the reader
// script unregistered, the optional permissions removed (extension), every
// Sipakamase key deleted, and on the phone the vault cookie dropped (the
// caller does that part). Pure: browser and phone APIs are injected.
//
// The extension asks for `scripting` and the Sipakamase host inside the click
// on "Hubungkan" (chrome.permissions.request needs a user gesture). The
// reader runs only on the four pages a student opens there, never on the
// login page, and makes no request (entrypoints/sipakamase-reader.ts).

import type { KeyValueStore, UnixSeconds } from '../types';
import { SIPAKAMASE_HOST_PERMISSION, SIPAKAMASE_ORIGIN } from './allowlist';
import { CONNECTION_KEY, type Connection } from './connection';
import { wipeSipakamaseData } from './store';

export const SIPAKAMASE_MODULE_KEY = 'global:sipakamase';

export const SIPAKAMASE_PERMISSIONS = {
  permissions: ['scripting'],
  origins: [SIPAKAMASE_HOST_PERMISSION],
} as const;

export const READER_SCRIPT_ID = 'sulo-sipakamase-reader';
export const READER_SCRIPT_FILE = 'sipakamase-reader.js';

/** The pages whose fragments Sulo reads; /home (personal data) and the login page are not among them. */
export const READER_MATCHES = ['caktifitasmahasiswa', 'caktifitas', 'ckonversimhs', 'cklaim'].map((p) => `${SIPAKAMASE_ORIGIN}/${p}*`);

export interface SipakamaseModuleState {
  enabled: boolean;
  changedAt: UnixSeconds | null;
}

export const MODULE_OFF: SipakamaseModuleState = { enabled: false, changedAt: null };

export interface ReaderScript {
  id: string;
  matches: string[];
  js: string[];
  runAt: 'document_idle';
  world: 'ISOLATED';
  allFrames: false;
  persistAcrossSessions: true;
}

export const READER_SCRIPT: ReaderScript = {
  id: READER_SCRIPT_ID,
  matches: READER_MATCHES,
  js: [READER_SCRIPT_FILE],
  runAt: 'document_idle',
  world: 'ISOLATED',
  allFrames: false,
  persistAcrossSessions: true,
};

export interface ScriptingApi {
  registerContentScripts(scripts: ReaderScript[]): Promise<void>;
  unregisterContentScripts(filter: { ids: string[] }): Promise<void>;
  getRegisteredContentScripts(filter: { ids: string[] }): Promise<{ id: string }[]>;
}

export interface ModuleDeps {
  store: KeyValueStore;
  now: () => UnixSeconds;
  /** Extension: chrome.permissions.contains(SIPAKAMASE_PERMISSIONS). Phone: always true. */
  hasPermissions: () => Promise<boolean>;
  removePermissions: () => Promise<void>;
  /** Extension: chrome.scripting while granted. Phone: null (no script; its sign-in screen has none). */
  scripting: () => ScriptingApi | null;
  /** Phone: drop the vault cookie and the WebView's cookie for the host. */
  forgetSession?: () => Promise<void>;
}

export async function readSipakamaseModule(store: KeyValueStore): Promise<SipakamaseModuleState> {
  const raw = await store.get<SipakamaseModuleState>(SIPAKAMASE_MODULE_KEY);
  return raw && typeof raw.enabled === 'boolean' ? { enabled: raw.enabled, changedAt: raw.changedAt ?? null } : MODULE_OFF;
}

const IDS = { ids: [READER_SCRIPT_ID] };

async function unregister(api: ScriptingApi | null): Promise<void> {
  if (!api) return;
  const present = await api.getRegisteredContentScripts(IDS).catch(() => []);
  if (present.length > 0) await api.unregisterContentScripts(IDS);
}

export type EnableResult = 'enabled' | 'no_permission' | 'failed';

/** After consent (and, in the extension, the granted permissions): the reader registered, the module on, waiting for a sign-in. */
export async function enableSipakamase(deps: ModuleDeps, withScript: boolean): Promise<EnableResult> {
  if (!(await deps.hasPermissions())) return 'no_permission';
  if (withScript) {
    const api = deps.scripting();
    if (!api) return 'no_permission';
    try {
      await unregister(api);
      await api.registerContentScripts([{ ...READER_SCRIPT, matches: [...READER_SCRIPT.matches], js: [...READER_SCRIPT.js] }]);
    } catch {
      await unregister(api).catch(() => undefined);
      return 'failed';
    }
  }
  const now = deps.now();
  await deps.store.set<SipakamaseModuleState>(SIPAKAMASE_MODULE_KEY, { enabled: true, changedAt: now });
  await deps.store.set<Connection>(CONNECTION_KEY, { state: 'needs_login', since: now, cause: 'connect' });
  return 'enabled';
}

/** Putuskan, a removed permission, "Hapus semua data", a new SIKOLA account. Every step runs even when one fails. */
export async function disableSipakamase(deps: ModuleDeps): Promise<void> {
  await unregister(deps.scripting()).catch(() => undefined);
  await deps.removePermissions().catch(() => undefined);
  await deps.forgetSession?.().catch(() => undefined);
  await wipeSipakamaseData(deps.store);
  await deps.store.set<SipakamaseModuleState>(SIPAKAMASE_MODULE_KEY, { enabled: false, changedAt: deps.now() });
}

export type ReconcileResult = 'off' | 'on' | 'turned_off' | 'reregistered';

/** Startup and a removed permission: on only while its permissions are; a dropped script registered again. */
export async function reconcileSipakamase(deps: ModuleDeps, withScript: boolean): Promise<ReconcileResult> {
  const state = await readSipakamaseModule(deps.store);
  if (!state.enabled) {
    await unregister(deps.scripting()).catch(() => undefined);
    return 'off';
  }
  if (!(await deps.hasPermissions())) {
    await disableSipakamase(deps);
    return 'turned_off';
  }
  if (!withScript) return 'on';
  const api = deps.scripting();
  const present = api ? await api.getRegisteredContentScripts(IDS).catch(() => []) : [];
  if (present.length > 0) return 'on';
  try {
    if (!api) throw new Error('no scripting');
    await api.registerContentScripts([{ ...READER_SCRIPT, matches: [...READER_SCRIPT.matches], js: [...READER_SCRIPT.js] }]);
    return 'reregistered';
  } catch {
    await disableSipakamase(deps);
    return 'turned_off';
  }
}
