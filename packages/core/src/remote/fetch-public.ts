// Fetches one JSON file from the public data repository (sulo-data), at most
// once a day per file. Reused by the remote config and, later, the academic
// calendar. Pure: scheduler, storage and clock are injected.
//
// - The request carries no cookie and no header or parameter of Sulo's own
//   (project rule 7). The domain policy sets `cache: 'no-cache'`, so the
//   browser revalidates its cached copy; a 304 from that revalidation, or a
//   body whose Last-Modified or content hash did not change, is "unchanged",
//   never an error.
// - When: immediately if never fetched; afterwards at least 24 hours apart,
//   from the installation's random fetch hour (`global:fetchSlot`) onwards,
//   or regardless of the hour after 48 hours.
// - The attempt time is recorded even on failure, so failures are not
//   retried sooner than the next day.

import type { Scheduler } from '../net/scheduler';
import type { Clock, KeyValueStore, UnixSeconds } from '../types';

const HOUR = 3600;
export const PUBLIC_MIN_GAP_H = 24;
export const PUBLIC_ANY_HOUR_AFTER_H = 48;
export const FETCH_SLOT_KEY = 'global:fetchSlot';
/** Fetch hours are drawn from 06.00 to 21.59 local time (never quiet hours). */
export const FETCH_SLOT_HOURS = { first: 6, last: 21 } as const;

export interface PublicFileState {
  fetchedAt: UnixSeconds;
  lastModified: string | null;
  hash: string | null;
}

export type PublicFetchOutcome =
  | { kind: 'changed'; json: unknown }
  | { kind: 'unchanged' }
  | { kind: 'not_due' }
  | { kind: 'failed'; reason: string };

export interface PublicFetchDeps {
  scheduler: Scheduler;
  store: KeyValueStore;
  clock: Clock;
  url: string;
  /** Storage key for this file's fetch state. */
  stateKey: string;
  /** Local hour from which a daily fetch may run; undefined: any hour. */
  fetchSlotHour?: number;
  /** For the dev request log. */
  trigger: string;
}

/** The installation's fetch hour, drawn once and reused. */
export async function fetchSlotHour(store: KeyValueStore, random: () => number = Math.random): Promise<number> {
  const stored = await store.get<number>(FETCH_SLOT_KEY);
  if (typeof stored === 'number' && stored >= FETCH_SLOT_HOURS.first && stored <= FETCH_SLOT_HOURS.last) return stored;
  const span = FETCH_SLOT_HOURS.last - FETCH_SLOT_HOURS.first + 1;
  const value = FETCH_SLOT_HOURS.first + Math.min(span - 1, Math.floor(random() * span));
  await store.set(FETCH_SLOT_KEY, value);
  return value;
}

/** Pure: whether a daily public file may be fetched now. */
export function isPublicFetchDue(lastAttemptAt: UnixSeconds | null, now: UnixSeconds, localHour: number, slotHour?: number): boolean {
  if (lastAttemptAt === null || lastAttemptAt <= 0) return true;
  const age = now - lastAttemptAt;
  if (age < PUBLIC_MIN_GAP_H * HOUR) return false;
  if (slotHour === undefined || age >= PUBLIC_ANY_HOUR_AFTER_H * HOUR) return true;
  return localHour >= slotHour;
}

export async function readPublicFileState(store: KeyValueStore, key: string): Promise<PublicFileState | null> {
  return (await store.get<PublicFileState>(key)) ?? null;
}

/**
 * One fetch of a public JSON file. The caller validates `json` with Zod and
 * keeps its last valid value on anything other than "changed".
 * `lastAttemptAt` lets a caller that already stores its own time (the
 * remote config) keep that as the source of truth.
 */
export async function fetchPublicJson(deps: PublicFetchDeps, lastAttemptAt?: UnixSeconds | null): Promise<PublicFetchOutcome> {
  const previous = await readPublicFileState(deps.store, deps.stateKey);
  const now = deps.clock.now();
  const attempted = lastAttemptAt !== undefined ? lastAttemptAt : (previous?.fetchedAt ?? null);
  if (!isPublicFetchDue(attempted, now, deps.clock.localHour(), deps.fetchSlotHour)) return { kind: 'not_due' };

  const save = (patch: Partial<PublicFileState>) =>
    deps.store.set<PublicFileState>(deps.stateKey, {
      fetchedAt: now,
      lastModified: previous?.lastModified ?? null,
      hash: previous?.hash ?? null,
      ...patch,
    });

  const result = await deps.scheduler.request('sulo-data', deps.url, { method: 'GET' }, { trigger: deps.trigger });
  if (result.kind !== 'response') {
    await save({});
    return { kind: 'failed', reason: result.kind === 'refused' ? result.reason : result.kind };
  }
  const response = result.response;
  if (response.status === 304) {
    await save({});
    return { kind: 'unchanged' };
  }
  if (!response.ok) {
    await save({});
    return { kind: 'failed', reason: `http ${response.status}` };
  }

  let text: string;
  try {
    text = await response.text();
  } catch {
    await save({});
    return { kind: 'failed', reason: 'unreadable body' };
  }
  const lastModified = response.headers.get('last-modified');
  const hash = await sha256Hex(text);
  await save({ lastModified, hash });
  if (previous && previous.hash !== null && previous.hash === hash) return { kind: 'unchanged' };

  try {
    return { kind: 'changed', json: JSON.parse(text) as unknown };
  } catch {
    return { kind: 'failed', reason: 'invalid json' };
  }
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
