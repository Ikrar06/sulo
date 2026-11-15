// The last 100 sent requests, for the dev info panel. Dev and tester builds
// only: production never creates this log (background.ts passes no
// onRequest), so `global:requestLog` never exists there.
// Entries hold no query string, body or personal data (scheduler.ts).

import type { KeyValueStore } from '../types';
import type { RequestLogEntry } from './scheduler';

export const REQUEST_LOG_KEY = 'global:requestLog';
export const REQUEST_LOG_MAX = 100;

/** Newest first, at most REQUEST_LOG_MAX. */
export function appendRequestLog(log: readonly RequestLogEntry[], entry: RequestLogEntry): RequestLogEntry[] {
  return [entry, ...log].slice(0, REQUEST_LOG_MAX);
}

export async function readRequestLog(store: KeyValueStore): Promise<RequestLogEntry[]> {
  return (await store.get<RequestLogEntry[]>(REQUEST_LOG_KEY)) ?? [];
}

export function createRequestLogger(store: KeyValueStore): (entry: RequestLogEntry) => Promise<void> {
  // Orders writes from different domain queues; holds no data.
  let tail: Promise<unknown> = Promise.resolve();
  return (entry) => {
    const run = tail.then(async () => store.set(REQUEST_LOG_KEY, appendRequestLog(await readRequestLog(store), entry)));
    tail = run.catch(() => undefined);
    return run;
  };
}
