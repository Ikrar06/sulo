// Remote kill switch, served from the public repository Ikrar06/sulo-data.
// Data only, never code. Not a SIKOLA request, so it does not use the
// Moodle client or count against the daily budget. Fetched through the
// scheduler's sulo-data domain (lib/remote/fetch-public.ts).

import { z } from 'zod';
import { BACKGROUND_INTERVAL_MIN } from '../moodle/limits';
import { createScheduler, type Scheduler } from '../net/scheduler';
import type { Clock, FetchLike, KeyValueStore, RemoteConfig } from '../types';
import { fetchPublicJson } from './fetch-public';

export const REMOTE_CONFIG_KEY = 'global:remoteConfig';
/** Revalidation state (Last-Modified, content hash) of the config file. */
export const REMOTE_CONFIG_FILE_KEY = 'global:remoteFile:config';

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
  /** Used only when no scheduler is given (tests). */
  fetch?: FetchLike;
  scheduler?: Scheduler;
  store: KeyValueStore;
  clock: Clock;
  url: string;
  /** The installation's fetch hour; undefined: any hour once 24 hours passed. */
  fetchSlotHour?: number;
}

/**
 * Fetches the config at most once a day (fetch-public.ts). On failure or
 * invalid content the last stored value stays in force (default when none).
 * `fetchedAt` records the last attempt so failures are not retried sooner.
 */
export async function refreshRemoteConfig(deps: RefreshDeps): Promise<RemoteConfig> {
  const current = await readRemoteConfig(deps.store);
  if (!deps.url) return current;
  const scheduler = deps.scheduler ?? (deps.fetch ? createScheduler({ fetch: deps.fetch, store: deps.store, clock: deps.clock }) : null);
  if (!scheduler) return current;

  const outcome = await fetchPublicJson(
    { scheduler, store: deps.store, clock: deps.clock, url: deps.url, stateKey: REMOTE_CONFIG_FILE_KEY, fetchSlotHour: deps.fetchSlotHour, trigger: 'remote-config' },
    current.fetchedAt,
  );
  if (outcome.kind === 'not_due') return current;

  const parsed = outcome.kind === 'changed' ? remoteConfigSchema.safeParse(outcome.json) : null;
  const next = { ...(parsed?.success ? parsed.data : stripFetchedAt(current)), fetchedAt: deps.clock.now() };
  await deps.store.set(REMOTE_CONFIG_KEY, next);
  return next;
}

function stripFetchedAt(config: RemoteConfig): Omit<RemoteConfig, 'fetchedAt'> {
  return { enabled: config.enabled, minIntervalMinutes: config.minIntervalMinutes, message: config.message };
}
