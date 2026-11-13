import type { Clock, FetchLike, KeyValueStore } from '../lib/types';

export function memoryStore(initial: Record<string, unknown> = {}): KeyValueStore & {
  dump(): Record<string, unknown>;
} {
  let data: Record<string, unknown> = structuredClone(initial);
  return {
    async get<T>(key: string) {
      return structuredClone(data[key]) as T | undefined;
    },
    async set<T>(key: string, value: T) {
      data = { ...data, [key]: structuredClone(value) };
    },
    async remove(keys: string | string[]) {
      const drop = new Set(Array.isArray(keys) ? keys : [keys]);
      data = Object.fromEntries(Object.entries(data).filter(([k]) => !drop.has(k)));
    },
    async keys(prefix: string) {
      return Object.keys(data).filter((k) => k.startsWith(prefix));
    },
    dump: () => structuredClone(data),
  };
}

export function fixedClock(date = '2026-11-13', hour = 10, now = 1_794_000_000): Clock & {
  setDate(next: string): void;
} {
  let current = date;
  return {
    now: () => now,
    localDate: () => current,
    localHour: () => hour,
    setDate: (next: string) => {
      current = next;
    },
  };
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    ...init,
  });
}

export interface RecordedCall {
  url: string;
  init: RequestInit | undefined;
}

export function fakeFetch(respond: (call: RecordedCall) => Response | Promise<Response>): FetchLike & {
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const fn = async (url: string, init?: RequestInit) => {
    const call = { url, init };
    calls.push(call);
    return respond(call);
  };
  return Object.assign(fn, { calls });
}
