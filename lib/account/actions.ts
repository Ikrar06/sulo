// The two account actions the user confirms. Browser APIs are injected, so
// the order of the steps is tested in Vitest (tests/account-actions.test.ts).

import { switchUser } from '../storage';
import type { KeyValueStore } from '../types';
import { ACCOUNT_PENDING_KEY, readPending } from './pending';

export interface UseNewDeps {
  store: KeyValueStore;
  clearNotifications: () => Promise<void>;
  openSetup: (hash: string) => Promise<void>;
}

/**
 * "Pakai akun ini": the previous account's data is deleted now (the user
 * confirmed), the other account becomes current, and setup opens at the
 * connect step for it. Returns false when there was nothing to switch to.
 */
export async function useNewAccount(deps: UseNewDeps): Promise<boolean> {
  const pending = await readPending(deps.store);
  if (!pending) return false;
  await switchUser(deps.store, pending.userId);
  await deps.store.remove(ACCOUNT_PENDING_KEY);
  await deps.clearNotifications();
  await deps.openSetup('#switch-account');
  return true;
}

export interface WipeDeps {
  /** True while a sync holds its lock. */
  syncRunning: () => Promise<boolean>;
  sleep: (ms: number) => Promise<void>;
  clearAlarms: () => Promise<void>;
  /** Runs before the storage is cleared (the NEOSIA module turns off). */
  beforeClear?: () => Promise<void>;
  clearNotifications: () => Promise<void>;
  clearLocal: () => Promise<void>;
  clearSession: () => Promise<void>;
  /** Recreates the periodic and badge alarms. */
  ensureAlarms: () => Promise<void>;
  openSetup: (hash: string) => Promise<void>;
}

/** How long "Hapus semua data" waits for a running sync (it must not write back). */
export const WIPE_WAIT_MS = 30_000;
const WIPE_POLL_MS = 500;

/**
 * "Hapus semua data": waits for a running sync, then clears alarms,
 * notifications, every local key (data, the other account's note,
 * preferences) and the session storage (sesskey). The base alarms come back
 * and setup opens as on a fresh install.
 */
export async function wipeAllData(deps: WipeDeps): Promise<void> {
  for (let waited = 0; waited < WIPE_WAIT_MS && (await deps.syncRunning()); waited += WIPE_POLL_MS) await deps.sleep(WIPE_POLL_MS);
  await deps.clearAlarms();
  await deps.clearNotifications();
  await deps.beforeClear?.().catch(() => undefined);
  await deps.clearLocal();
  await deps.clearSession();
  await deps.ensureAlarms();
  await deps.openSetup('');
}
