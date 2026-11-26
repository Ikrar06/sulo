// Remote kill switch, served from the public repository Ikrar06/sulo-data.
// Data only, never code. Not a SIKOLA request, so it does not use the
// Moodle client or count against the daily budget. Fetched through the
// scheduler's sulo-data domain (lib/remote/fetch-public.ts).

import { z } from 'zod';
import { BACKGROUND_INTERVAL_MIN } from '../moodle/limits';
import { createScheduler, type Scheduler } from '../net/scheduler';
import type { Clock, FetchLike, KeyValueStore, RemoteConfig } from '../types';
import { fetchPublicJson } from './fetch-public';
import { extensionWatchSwitchReadable } from './extension-watch';

export const REMOTE_CONFIG_KEY = 'global:remoteConfig';
/** Revalidation state (Last-Modified, content hash) of the config file. */
export const REMOTE_CONFIG_FILE_KEY = 'global:remoteFile:config';

export const remoteConfigSchema = z.object({
  enabled: z.boolean(),
  minIntervalMinutes: z.number().int().nonnegative(),
  message: z.string().max(500).default(''),
  // The phone's section, kept as is and validated field by field on read
  // (remote/keep-alive.ts): an out-of-range interval takes its default.
  // One exception: a switch that is there but not a boolean makes the whole
  // file invalid, so a broken switch is never read as permission.
  mobile: z.unknown().optional(),
  // The extension's section (1.1.0), read the same way (remote/extension-watch.ts).
  extension: z.unknown().optional(),
})
  .refine((c) => keepAliveSwitchReadable(c.mobile), { message: 'mobile.backgroundKeepAlive.enabled must be a boolean' })
  .refine((c) => extensionWatchSwitchReadable(c.extension), { message: 'extension.backgroundWatch.enabled must be a boolean' });

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The switch's path, when present, is readable: `mobile` and `backgroundKeepAlive` are objects, `enabled` a boolean. */
function keepAliveSwitchReadable(mobile: unknown): boolean {
  if (mobile === undefined) return true;
  if (!isObject(mobile)) return false;
  const k = mobile.backgroundKeepAlive;
  if (k === undefined) return true;
  if (!isObject(k)) return false;
  return k.enabled === undefined || typeof k.enabled === 'boolean';
}

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
  /** Hours since the last read before another (default 24; the phone uses 6 when the app is opened). */
  minGapHours?: number;
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
    { scheduler, store: deps.store, clock: deps.clock, url: deps.url, stateKey: REMOTE_CONFIG_FILE_KEY, fetchSlotHour: deps.fetchSlotHour, minGapHours: deps.minGapHours, trigger: 'remote-config' },
    current.fetchedAt,
  );
  if (outcome.kind === 'not_due') return current;

  const parsed = outcome.kind === 'changed' ? remoteConfigSchema.safeParse(outcome.json) : null;
  // A good read: valid new content, or the same content confirmed. A failure or invalid content keeps the last good one and its time.
  const good = parsed?.success === true || outcome.kind === 'unchanged';
  const okAt = good ? deps.clock.now() : current.okAt;
  const next = { ...(parsed?.success ? parsed.data : stripFetchedAt(current)), fetchedAt: deps.clock.now(), ...(okAt ? { okAt } : {}) };
  await deps.store.set(REMOTE_CONFIG_KEY, next);
  return next;
}

function stripFetchedAt(config: RemoteConfig): Omit<RemoteConfig, 'fetchedAt'> {
  return { enabled: config.enabled, minIntervalMinutes: config.minIntervalMinutes, message: config.message, ...(config.mobile !== undefined ? { mobile: config.mobile } : {}) };
}
