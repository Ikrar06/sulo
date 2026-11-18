// Single-flight for syncs.
// - Inside one service worker: one promise in flight; a second trigger waits
//   for the same result and sends no request of its own.
// - Across service-worker restarts: a lock in storage with a cycle id and an
//   expiry. The running cycle renews it every 30 seconds, so it never expires
//   while the sync is alive; a lock not renewed for 2 minutes is dead and may
//   be taken over.
// Storage, time and timers are injected so this runs in Vitest.

import type { KeyValueStore, SyncOutcome, UnixSeconds } from '../types';

export const SYNC_LOCK_KEY = 'global:syncLock';
/** A lock not renewed for this long belongs to a dead cycle. */
export const LOCK_TTL_S = 120;
/** The running cycle renews its lock this often. */
export const LOCK_RENEW_MS = 30_000;

export interface SyncLock {
  cycleId: string;
  expiresAt: UnixSeconds;
}

export const isLockAlive = (lock: SyncLock | undefined, now: UnixSeconds): lock is SyncLock => !!lock && lock.expiresAt > now;

/** Whether a sync is running right now (for "Sedang memperbarui"). */
export async function isSyncRunning(store: KeyValueStore, now: UnixSeconds): Promise<boolean> {
  return isLockAlive(await store.get<SyncLock>(SYNC_LOCK_KEY), now);
}

export async function acquireLock(store: KeyValueStore, now: UnixSeconds, cycleId: string): Promise<boolean> {
  const current = await store.get<SyncLock>(SYNC_LOCK_KEY);
  if (isLockAlive(current, now) && current.cycleId !== cycleId) return false;
  await store.set<SyncLock>(SYNC_LOCK_KEY, { cycleId, expiresAt: now + LOCK_TTL_S });
  return true;
}

export async function renewLock(store: KeyValueStore, now: UnixSeconds, cycleId: string): Promise<void> {
  const current = await store.get<SyncLock>(SYNC_LOCK_KEY);
  if (current?.cycleId === cycleId) await store.set<SyncLock>(SYNC_LOCK_KEY, { cycleId, expiresAt: now + LOCK_TTL_S });
}

export async function releaseLock(store: KeyValueStore, cycleId: string): Promise<void> {
  const current = await store.get<SyncLock>(SYNC_LOCK_KEY);
  if (current?.cycleId === cycleId) await store.remove(SYNC_LOCK_KEY);
}

export interface SingleFlightDeps<T> {
  store: KeyValueStore;
  now: () => UnixSeconds;
  newId: () => string;
  run: (trigger: T) => Promise<SyncOutcome>;
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (handle: unknown) => void;
}

/**
 * Wraps the sync so overlapping triggers share one run. The in-flight
 * promise only sequences work inside this worker; all data stays in storage.
 */
export function createSingleFlight<T>(deps: SingleFlightDeps<T>): (trigger: T) => Promise<SyncOutcome> {
  let inflight: Promise<SyncOutcome> | null = null;
  return (trigger: T) => {
    if (inflight) return inflight;
    inflight = (async (): Promise<SyncOutcome> => {
      const cycleId = deps.newId();
      if (!(await acquireLock(deps.store, deps.now(), cycleId))) return { status: 'skipped', reason: 'BUSY' };
      const timer = deps.setInterval(() => void renewLock(deps.store, deps.now(), cycleId), LOCK_RENEW_MS);
      try {
        return await deps.run(trigger);
      } finally {
        deps.clearInterval(timer);
        await releaseLock(deps.store, cycleId);
      }
    })().finally(() => {
      inflight = null;
    });
    return inflight;
  };
}
