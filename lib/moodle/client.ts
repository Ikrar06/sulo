// The single gateway for every request to SIKOLA (project rules: one gateway, never parallel).
// Pure module: fetch, storage, clock and sesskey are injected.
//
// Every request passes the same gates, in order: allowlist, remote kill
// switch, session not EXPIRED, not backing off, (sesskey for JSON), budget.
// The budget (requests and function calls) is reserved before sending. The
// fetch itself goes through the per-domain scheduler (lib/net/scheduler.ts),
// which owns the SIKOLA backoff; a login redirect sets the session EXPIRED.

import { recordTech, statusOf } from '../net/tech-log';
import type { ClientRefusal, Clock, FetchLike, KeyValueStore, RequestSource } from '../types';
import { createScheduler, type Scheduler } from '../net/scheduler';
import { readRemoteConfig } from '../remote/remote-config';
import { isBackingOff, readBackoff } from './backoff';
import { reserveRequest } from './budget';
import { isAllowedFunction, isAllowedPage, type MoodleCall } from './calls';
import { DAILY_BUDGET, DAILY_CALL_BUDGET, SEND_NOSESSIONUPDATE } from './limits';
import { batchResponseSchema, topLevelErrorSchema } from './schemas';
import { readSession, writeSession } from './session';

export interface MoodleClientDeps {
  fetch: FetchLike;
  store: KeyValueStore;
  clock: Clock;
  baseUrl: string;
  getSesskey: () => Promise<string | null>;
  dailyBudget?: number;
  dailyCallBudget?: number;
  /** Shared scheduler (background). Without one, the client makes its own from fetch. */
  scheduler?: Scheduler;
  /** Adds nosessionupdate=true to batches; default SEND_NOSESSIONUPDATE. */
  noSessionUpdate?: boolean;
}

export type CallResult = { ok: true; data: unknown } | { ok: false; errorcode: string };

/** Outcomes shared by JSON batches and HTML pages. */
export type TransportFailure =
  | { kind: 'refused'; reason: ClientRefusal }
  | { kind: 'login_required' }
  | { kind: 'network_error' }
  | { kind: 'timeout' }
  | { kind: 'http_error'; status: number }
  | { kind: 'bad_response'; detail: string };

export type BatchOutcome = { kind: 'ok'; results: CallResult[] } | { kind: 'invalid_sesskey' } | TransportFailure;

export type PageOutcome = { kind: 'ok'; html: string } | TransportFailure;

/** Tags each request for the per-source counter. */
export interface RequestOptions {
  source?: RequestSource;
  /** True when the batch also carries the daily course list. */
  withCourseList?: boolean;
}

export interface MoodleClient {
  callBatch(calls: readonly MoodleCall[], options?: RequestOptions): Promise<BatchOutcome>;
  /** GET an allowlisted HTML page, e.g. "/my/". Only on user request. */
  fetchPage(pathAndQuery: string, options?: RequestOptions): Promise<PageOutcome>;
}

const LOGIN_ERRORCODES = new Set(['servicerequireslogin', 'requireloginerror']);
const SESSKEY_ERRORCODES = new Set(['invalidsesskey']);

export function createMoodleClient(input: MoodleClientDeps): MoodleClient {
  const deps: ResolvedDeps = {
    ...input,
    scheduler: input.scheduler ?? createScheduler({ fetch: input.fetch, store: input.store, clock: input.clock }),
  };
  // Promise chain that serializes requests within this context. It holds no
  // data, only ordering, so losing it on service worker restart is harmless.
  let tail: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task);
    tail = run.catch(() => undefined);
    return run;
  };

  return {
    // Every outcome goes into the technical log (function names and status only).
    callBatch: (calls, options = {}) =>
      enqueue(async () => {
        const outcome = await executeBatch(deps, calls, options);
        await recordTech(deps.store, { at: deps.clock.now(), fn: calls.map((c) => c.methodname).join('+'), status: statusOf(outcome) }).catch(() => undefined);
        return outcome;
      }),
    fetchPage: (path, options = {}) =>
      enqueue(async () => {
        const outcome = await executePage(deps, path, options);
        await recordTech(deps.store, { at: deps.clock.now(), fn: 'page', status: statusOf(outcome) }).catch(() => undefined);
        return outcome;
      }),
  };
}

type ResolvedDeps = MoodleClientDeps & { scheduler: Scheduler };

/** The batch endpoint. nosessionupdate keeps Sulo's checks from extending the SIKOLA session. */
export function batchPath(sesskey: string, noSessionUpdate: boolean = SEND_NOSESSIONUPDATE): string {
  const query = `sesskey=${encodeURIComponent(sesskey)}${noSessionUpdate ? '&nosessionupdate=true' : ''}`;
  return `/lib/ajax/service.php?${query}`;
}

async function executeBatch(deps: ResolvedDeps, calls: readonly MoodleCall[], options: RequestOptions): Promise<BatchOutcome> {
  if (calls.length === 0 || !calls.every((c) => isAllowedFunction(c.methodname))) {
    return refused('NOT_ALLOWLISTED');
  }
  const gate = await checkGates(deps);
  if (gate) return gate;

  const sesskey = await deps.getSesskey();
  if (!sesskey) return refused('NO_SESSKEY');

  const sent = await send(
    deps,
    batchPath(sesskey, deps.noSessionUpdate),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(calls.map((c, index) => ({ index, methodname: c.methodname, args: c.args }))),
    },
    options,
    calls.length,
  );
  if (sent.kind !== 'response') return sent;

  const outcome = await interpretBatch(sent.response, calls);
  if (outcome.kind === 'login_required') await writeSession(deps.store, deps.clock, 'EXPIRED');
  return outcome;
}

async function executePage(deps: ResolvedDeps, pathAndQuery: string, options: RequestOptions): Promise<PageOutcome> {
  const url = safeUrl(pathAndQuery, deps.baseUrl);
  if (!url || !isAllowedPage(url.pathname)) return refused('NOT_ALLOWLISTED');
  const gate = await checkGates(deps);
  if (gate) return gate;

  const sent = await send(deps, `${url.pathname}${url.search}`, { method: 'GET' }, options, 0);
  if (sent.kind !== 'response') return sent;

  const outcome = await interpretPage(sent.response);
  if (outcome.kind === 'login_required') await writeSession(deps.store, deps.clock, 'EXPIRED');
  return outcome;
}

async function checkGates(deps: MoodleClientDeps): Promise<TransportFailure | null> {
  if (!(await readRemoteConfig(deps.store)).enabled) return refused('DISABLED_REMOTELY');
  if ((await readSession(deps.store)).state === 'EXPIRED') return refused('SESSION_EXPIRED');
  if (isBackingOff(await readBackoff(deps.store), deps.clock.now())) return refused('BACKING_OFF');
  return null;
}

type SendResult = { kind: 'response'; response: Response } | TransportFailure;

/** Hands the request to the scheduler, which reserves the budget just before fetch. */
async function send(deps: ResolvedDeps, path: string, init: RequestInit, options: RequestOptions, callCount: number): Promise<SendResult> {
  const source = options.source ?? 'manual';
  const result = await deps.scheduler.request('sikola', `${deps.baseUrl}${path}`, init, {
    trigger: source,
    calls: callCount,
    reserve: () =>
      reserveRequest(
        deps.store,
        deps.clock,
        deps.dailyBudget ?? DAILY_BUDGET,
        source,
        options.withCourseList ?? false,
        callCount,
        deps.dailyCallBudget ?? DAILY_CALL_BUDGET,
      ),
  });
  return result;
}

function isRedirect(response: Response): boolean {
  return response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400);
}

/**
 * Reads a batch response. The session counts as gone (login_required) or the
 * sesskey as invalid only from the top level (redirect, HTML, top-level
 * error) or from core_session_time_remaining itself. When that call
 * succeeded, the session is valid whatever the other calls returned: an
 * error on one course's get_state is that call's error, never a logout.
 */
export async function interpretBatch(response: Response, calls: readonly MoodleCall[]): Promise<BatchOutcome> {
  const expected = calls.length;
  if (isRedirect(response)) return { kind: 'login_required' };
  if (!response.ok) return { kind: 'http_error', status: response.status };

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) return { kind: 'login_required' };
  if (!contentType.includes('json')) return { kind: 'bad_response', detail: `content-type ${contentType || 'missing'}` };

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { kind: 'bad_response', detail: 'invalid json' };
  }

  const topLevel = topLevelErrorSchema.safeParse(json);
  if (topLevel.success) return classifyError(topLevel.data.errorcode);

  const parsed = batchResponseSchema.safeParse(json);
  if (!parsed.success) return { kind: 'bad_response', detail: 'schema mismatch' };
  if (parsed.data.length !== expected) return { kind: 'bad_response', detail: 'length mismatch' };

  const results: CallResult[] = parsed.data.map((item) =>
    item.error ? { ok: false, errorcode: item.exception.errorcode } : { ok: true, data: item.data },
  );
  const sessionIndex = calls.findIndex((c) => c.methodname === 'core_session_time_remaining');
  const session = sessionIndex >= 0 ? results[sessionIndex] : undefined;
  if (session && !session.ok && (LOGIN_ERRORCODES.has(session.errorcode) || SESSKEY_ERRORCODES.has(session.errorcode))) {
    return classifyError(session.errorcode);
  }
  return { kind: 'ok', results };
}

async function interpretPage(response: Response): Promise<PageOutcome> {
  if (isRedirect(response)) return { kind: 'login_required' };
  if (!response.ok) return { kind: 'http_error', status: response.status };
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) return { kind: 'bad_response', detail: `content-type ${contentType || 'missing'}` };
  try {
    return { kind: 'ok', html: await response.text() };
  } catch {
    return { kind: 'bad_response', detail: 'unreadable body' };
  }
}

function classifyError(errorcode: string): BatchOutcome {
  if (LOGIN_ERRORCODES.has(errorcode)) return { kind: 'login_required' };
  if (SESSKEY_ERRORCODES.has(errorcode)) return { kind: 'invalid_sesskey' };
  return { kind: 'bad_response', detail: `errorcode ${errorcode}` };
}

function refused(reason: ClientRefusal): { kind: 'refused'; reason: ClientRefusal } {
  return { kind: 'refused', reason };
}

function safeUrl(pathAndQuery: string, baseUrl: string): URL | null {
  try {
    const url = new URL(pathAndQuery, baseUrl);
    return url.origin === new URL(baseUrl).origin ? url : null;
  } catch {
    return null;
  }
}
