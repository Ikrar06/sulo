// Per-domain request scheduler: the only place in Sulo that calls fetch.
// Pure module: fetch, storage, clock and randomness are injected.
//
// For every request, in order: the domain exists and allows requests, the URL
// is on that domain, the domain is not backing off, the caller's quota
// reservation (if any) succeeds. Then one fetch with the domain's fixed
// options and a timeout. 429, 5xx, timeouts and network errors feed that
// domain's backoff; any other response resets it.
//
// Each domain has its own serial queue, so two requests to the same domain
// never run at the same time. The queues hold no data, only ordering.

import { isBackingOff, parseRetryAfter, readBackoff, recordFailure, recordSuccess } from '../moodle/backoff';
import type { ClientRefusal, Clock, FetchLike, KeyValueStore, UnixSeconds } from '../types';
import { DOMAINS, type DomainId, type DomainPolicy } from './domains';

export type NetResult =
  | { kind: 'response'; response: Response }
  | { kind: 'refused'; reason: ClientRefusal }
  | { kind: 'network_error' }
  | { kind: 'timeout' }
  | { kind: 'http_error'; status: number };

export interface NetRequestMeta {
  /** What caused the request (sync trigger, "remote-config", ...), for the dev log. */
  trigger: string;
  /** Moodle function calls in the request (0 for pages and data files). */
  calls?: number;
  /** Reserves quota just before sending; false refuses with BUDGET_EXHAUSTED. */
  reserve?: () => Promise<boolean>;
}

/** One sent request, for the dev and tester request log. Never a URL query or body. */
export interface RequestLogEntry {
  at: UnixSeconds;
  domain: DomainId;
  /** Path only, without query (the SIKOLA query carries the sesskey). */
  path: string;
  trigger: string;
  calls: number;
  /** Response body length in characters; null when unreadable. */
  bytes: number | null;
  outcome: string;
}

export interface SchedulerDeps {
  fetch: FetchLike;
  store: KeyValueStore;
  clock: Clock;
  /** Jitter source for backoff, [0, 1]. Default: no jitter. */
  random?: () => number;
  /** Dev and tester builds only: receives every sent request. */
  onRequest?: (entry: RequestLogEntry) => Promise<void> | void;
  /** Overrides for tests; production uses DOMAINS. */
  domains?: Readonly<Record<DomainId, DomainPolicy>>;
}

export interface Scheduler {
  request(domain: DomainId, url: string, init: RequestInit, meta: NetRequestMeta): Promise<NetResult>;
}

export function createScheduler(deps: SchedulerDeps): Scheduler {
  const domains = deps.domains ?? DOMAINS;
  const tails = new Map<DomainId, Promise<unknown>>();
  const enqueue = <T>(domain: DomainId, task: () => Promise<T>): Promise<T> => {
    const run = (tails.get(domain) ?? Promise.resolve()).then(task);
    tails.set(domain, run.catch(() => undefined));
    return run;
  };

  return {
    request: (domain, url, init, meta) => enqueue(domain, () => send(deps, domains[domain], url, init, meta)),
  };
}

async function send(deps: SchedulerDeps, policy: DomainPolicy, url: string, init: RequestInit, meta: NetRequestMeta): Promise<NetResult> {
  if (!policy.allowRequests) return refused('DOMAIN_DENIED');
  if (!isOnDomain(url, policy)) return refused('NOT_ALLOWLISTED');
  if (policy.readOnlyPaths && !isAllowedReadOnly(url, init, policy.readOnlyPaths)) return refused('NOT_ALLOWLISTED');
  const now = deps.clock.now();
  if (isBackingOff(await readBackoff(deps.store, policy.backoffKey), now)) return refused('BACKING_OFF');
  if (meta.reserve && !(await meta.reserve())) return refused('BUDGET_EXHAUSTED');

  const log = (outcome: string, bytes: number | null) =>
    deps.onRequest?.({ at: now, domain: policy.id, path: pathOf(url), trigger: meta.trigger, calls: meta.calls ?? 0, bytes, outcome });
  const backoff = { key: policy.backoffKey, random: deps.random };

  let response: Response;
  try {
    response = await deps.fetch(url, { ...init, ...policy.init, signal: AbortSignal.timeout(policy.timeoutMs) });
  } catch (error) {
    await recordFailure(deps.store, deps.clock, null, backoff);
    const timedOut = isTimeoutError(error);
    await log(timedOut ? 'timeout' : 'network_error', null);
    return timedOut ? { kind: 'timeout' } : { kind: 'network_error' };
  }

  if (response.status === 429 || response.status >= 500) {
    const retryAfter = parseRetryAfter(response.headers.get('retry-after'), now);
    await recordFailure(deps.store, deps.clock, retryAfter, backoff);
    await log(`http ${response.status}`, await bodyLength(deps, response));
    return { kind: 'http_error', status: response.status };
  }
  await recordSuccess(deps.store, policy.backoffKey);
  await log(response.type === 'opaqueredirect' ? 'redirect' : `http ${response.status}`, await bodyLength(deps, response));
  return { kind: 'response', response };
}

/** A read-only domain: GET, one of its exact paths, no query, no fragment, no credentials in the URL. */
export function isAllowedReadOnly(url: string, init: RequestInit, paths: readonly string[]): boolean {
  if ((init.method ?? 'GET').toUpperCase() !== 'GET' || init.body !== undefined) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.search === '' && parsed.hash === '' && parsed.username === '' && parsed.password === '' && paths.includes(parsed.pathname);
}

/** Exact origin match: no subdomains, no lookalikes. */
export function isOnDomain(url: string, policy: DomainPolicy): boolean {
  return policy.origins.includes(safeOrigin(url));
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return '';
  }
}

/** Only measured when someone logs (dev and tester builds); reads a clone. */
async function bodyLength(deps: SchedulerDeps, response: Response): Promise<number | null> {
  if (!deps.onRequest || response.type === 'opaqueredirect') return null;
  try {
    return (await response.clone().text()).length;
  } catch {
    return null;
  }
}

function refused(reason: ClientRefusal): NetResult {
  return { kind: 'refused', reason };
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');
}
