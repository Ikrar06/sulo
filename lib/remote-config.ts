// Remote kill switch, served from the public repository Ikrar06/sulo-data.
// Data only, never code. Not a SIKOLA request, so it does not use the
// Moodle client or count against the daily budget.

import { z } from 'zod';
import { BACKGROUND_INTERVAL_MIN, REMOTE_CONFIG_MIN_GAP_H, REQUEST_TIMEOUT_MS } from './moodle/limits';
import type { Clock, FetchLike, KeyValueStore, RemoteConfig } from './types';

export const REMOTE_CONFIG_KEY = 'global:remoteConfig';

export const remoteConfigSchema = z.object({
  enabled: z.boolean(),
  minIntervalMinutes: z.number().int().nonnegative(),
  message: z.string().max(500).default(''),
});

export const DEFAULT_REMOTE_CONFIG: RemoteConfig = {
  enabled: true,
  minIntervalMinutes: BACKGROUND_INTERVAL_MIN,
  message: '',
  fetchedAt: 0,
};

export async function readRemoteConfig(store: KeyValueStore): Promise<RemoteConfig> {
  return (await store.get<RemoteConfig>(REMOTE_CONFIG_KEY)) ?? DEFAULT_REMOTE_CONFIG;
}

/** The remote value can only slow background sync down, never speed it up. */
export function effectiveIntervalMinutes(config: RemoteConfig): number {
  return Math.max(config.minIntervalMinutes, BACKGROUND_INTERVAL_MIN);
}

export interface RefreshDeps {
  fetch: FetchLike;
  store: KeyValueStore;
  clock: Clock;
  url: string;
}

/**
 * Fetches the config at most once per REMOTE_CONFIG_MIN_GAP_H. On failure or
 * invalid content the last stored value stays in force (default when none).
 * `fetchedAt` records the last attempt so failures are not retried sooner.
 */
export async function refreshRemoteConfig(deps: RefreshDeps): Promise<RemoteConfig> {
  const current = await readRemoteConfig(deps.store);
  if (!deps.url) return current;

  const now = deps.clock.now();
  if (current.fetchedAt > 0 && now - current.fetchedAt < REMOTE_CONFIG_MIN_GAP_H * 3600) return current;

  const next = { ...(await fetchConfig(deps)) ?? stripFetchedAt(current), fetchedAt: now };
  await deps.store.set(REMOTE_CONFIG_KEY, next);
  return next;
}

async function fetchConfig(deps: RefreshDeps): Promise<Omit<RemoteConfig, 'fetchedAt'> | null> {
  try {
    const response = await deps.fetch(deps.url, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const parsed = remoteConfigSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function stripFetchedAt(config: RemoteConfig): Omit<RemoteConfig, 'fetchedAt'> {
  return { enabled: config.enabled, minIntervalMinutes: config.minIntervalMinutes, message: config.message };
}
