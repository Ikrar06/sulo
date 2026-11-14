import type { BackoffState, Clock, KeyValueStore, UnixSeconds } from '../types';
import { BACKOFF_MAX_H, BACKOFF_STEPS_H } from './limits';

export const BACKOFF_KEY = 'global:backoff';

const HOUR = 3600;
const IDLE_STATE: BackoffState = { failures: 0, nextAllowedAt: 0 };

/** Wait time after the given number of consecutive failures (1-based). */
export function backoffDelaySeconds(failures: number): number {
  if (failures <= 0) return 0;
  const step = BACKOFF_STEPS_H[failures - 1];
  return (step ?? BACKOFF_MAX_H) * HOUR;
}

/**
 * Parses a Retry-After header (delta seconds or HTTP date) into seconds from now.
 * Returns null when absent or unparseable.
 */
export function parseRetryAfter(header: string | null, now: UnixSeconds): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return null;
  return Math.max(0, Math.floor(date / 1000) - now);
}

/** Next state after a failure. Retry-After can only lengthen the wait, capped at 24 h. */
export function afterFailure(
  prev: BackoffState,
  now: UnixSeconds,
  retryAfterSeconds: number | null = null,
): BackoffState {
  const failures = prev.failures + 1;
  const computed = backoffDelaySeconds(failures);
  const honored = Math.min(Math.max(computed, retryAfterSeconds ?? 0), BACKOFF_MAX_H * HOUR);
  return { failures, nextAllowedAt: now + honored };
}

export function isBackingOff(state: BackoffState, now: UnixSeconds): boolean {
  return state.failures > 0 && now < state.nextAllowedAt;
}

export async function readBackoff(store: KeyValueStore): Promise<BackoffState> {
  return (await store.get<BackoffState>(BACKOFF_KEY)) ?? IDLE_STATE;
}

export async function recordFailure(
  store: KeyValueStore,
  clock: Clock,
  retryAfterSeconds: number | null,
): Promise<BackoffState> {
  const next = afterFailure(await readBackoff(store), clock.now(), retryAfterSeconds);
  await store.set(BACKOFF_KEY, next);
  return next;
}

export async function recordSuccess(store: KeyValueStore): Promise<void> {
  const current = await readBackoff(store);
  if (current.failures !== 0 || current.nextAllowedAt !== 0) await store.set(BACKOFF_KEY, IDLE_STATE);
}
