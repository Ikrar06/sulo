// "Pantau tugas baru" in the extension (1.1.0): the user's choice and
// whether it is in force. The checks themselves are ordinary light syncs
// (sync/run-sync.ts, triggers watch and popup); this only decides whether
// they run. Pure apart from the injected store.
//
// New installs turn it on in the setup (with one sentence on what it does);
// installs from before 1.1.0 stay off until the user turns it on, because
// they installed Sulo when it promised not to keep the session alive.

import type { KeyValueStore, RemoteConfig, UnixSeconds } from '../types';
import { extensionWatchFrom, type ExtensionWatchConfig } from '../remote/extension-watch';

export const EXTENSION_WATCH_KEY = 'global:extensionWatch';

export interface ExtensionWatchState {
  enabled: boolean;
  /** When the user last turned it on or off; null before any choice. */
  changedAt: UnixSeconds | null;
}

export const DEFAULT_EXTENSION_WATCH_STATE: ExtensionWatchState = { enabled: false, changedAt: null };

export async function readExtensionWatch(store: KeyValueStore): Promise<ExtensionWatchState> {
  const raw = await store.get<Partial<ExtensionWatchState>>(EXTENSION_WATCH_KEY);
  return {
    enabled: raw?.enabled === true,
    changedAt: typeof raw?.changedAt === 'number' ? raw.changedAt : null,
  };
}

export async function setExtensionWatch(store: KeyValueStore, enabled: boolean, now: UnixSeconds): Promise<ExtensionWatchState> {
  const next: ExtensionWatchState = { enabled, changedAt: now };
  await store.set(EXTENSION_WATCH_KEY, next);
  return next;
}

export interface WatchInForce {
  /** Checks run: the user turned it on and neither the global switch nor the watch switch is off. */
  on: boolean;
  /** The user's choice, whatever the config says (for the switch on screen). */
  chosen: boolean;
  /** Stopped by the maintainer (config): the switch shows it. */
  stoppedRemotely: boolean;
  config: ExtensionWatchConfig;
}

export function watchInForce(state: ExtensionWatchState, config: RemoteConfig | null): WatchInForce {
  const watch = extensionWatchFrom(config);
  const remoteOn = (config?.enabled ?? true) && watch.enabled;
  return { on: state.enabled && remoteOn, chosen: state.enabled, stoppedRemotely: !remoteOn, config: watch };
}
