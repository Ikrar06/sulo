// How long a NEOSIA session lasts (1.1.0, docs/mkpk/RENCANA.md 5b.1), noted
// in debug and tester builds only, with no request of its own: when a page
// showed NEOSIA signed in (data came in, or its login was left) and when a
// page landed on NEOSIA's login again. Times and events only. It tells
// whether the scheduled visit can keep NEOSIA useful (sources.neosia).

import type { KeyValueStore, UnixSeconds } from '../types';

export const NEOSIA_SESSION_LOG_KEY = 'neosia:sessionLog';
const MAX = 60;

export type NeosiaSessionEvent = 'signed_in' | 'needs_login';
export interface NeosiaSessionEntry {
  at: UnixSeconds;
  event: NeosiaSessionEvent;
  /** What saw it: a page opened from a tap, or the scheduled visit. */
  via: 'tap' | 'visit';
}

export async function noteNeosiaSession(store: KeyValueStore, entry: NeosiaSessionEntry): Promise<void> {
  const log = (await store.get<NeosiaSessionEntry[]>(NEOSIA_SESSION_LOG_KEY)) ?? [];
  await store.set(NEOSIA_SESSION_LOG_KEY, [...log, entry].slice(-MAX));
}

/** Each session's length in hours: from its first signed-in sighting to the next login page. */
export function neosiaSessionHours(log: readonly NeosiaSessionEntry[]): number[] {
  const out: number[] = [];
  let start: UnixSeconds | null = null;
  for (const e of log) {
    if (e.event === 'signed_in' && start === null) start = e.at;
    if (e.event === 'needs_login' && start !== null) {
      out.push(Math.round(((e.at - start) / 3600) * 10) / 10);
      start = null;
    }
  }
  return out;
}
