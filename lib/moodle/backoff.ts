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

/**
 * The step delay with jitter: a random point between half and the full step
 * (3 h becomes 1.5 to 3 h). Not "full jitter" (0 to the full step) on
 * purpose: a wait of a few minutes after a SIKOLA failure would be a retry
 * storm in disguise, and spreading installs over the second half is enough
 * (docs/ATURAN-REQUEST.md). `random` returns [0, 1]; 1 means no jitter.
 */
export function jitteredDelaySeconds(failures: number, random: () => number = () => 1): number {
  const base = backoffDelaySeconds(failures);
  const r = Math.min(1, Math.max(0, random()));
  return Math.round(base * (0.5 + 0.5 * r));
}

/** Next state after a failure. Retry-After can only lengthen the wait, capped at 24 h. */
export function afterFailure(
  prev: BackoffState,
  now: UnixSeconds,
  retryAfterSeconds: number | null = null,
  random: () => number = () => 1,
): BackoffState {
  const failures = prev.failures + 1;
  const computed = jitteredDelaySeconds(failures, random);
  const honored = Math.min(Math.max(computed, retryAfterSeconds ?? 0), BACKOFF_MAX_H * HOUR);
  return { failures, nextAllowedAt: now + honored };
}

export function isBackingOff(state: BackoffState, now: UnixSeconds): boolean {
  return state.failures > 0 && now < state.nextAllowedAt;
}

/** Each domain has its own backoff; the default key is SIKOLA's. */
export interface BackoffOptions {
  key?: string;
  random?: () => number;
}

export async function readBackoff(store: KeyValueStore, key: string = BACKOFF_KEY): Promise<BackoffState> {
  return (await store.get<BackoffState>(key)) ?? IDLE_STATE;
}

export async function recordFailure(
  store: KeyValueStore,
  clock: Clock,
  retryAfterSeconds: number | null,
  options: BackoffOptions = {},
): Promise<BackoffState> {
  const key = options.key ?? BACKOFF_KEY;
  const next = afterFailure(await readBackoff(store, key), clock.now(), retryAfterSeconds, options.random);
  await store.set(key, next);
  return next;
}

export async function recordSuccess(store: KeyValueStore, key: string = BACKOFF_KEY): Promise<void> {
  const current = await readBackoff(store, key);
  if (current.failures !== 0 || current.nextAllowedAt !== 0) await store.set(key, IDLE_STATE);
}
