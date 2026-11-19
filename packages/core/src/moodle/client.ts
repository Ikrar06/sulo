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
import { calls, isAllowedFunction, isAllowedPage, type MoodleCall } from './calls';
import { ATTENDANCE_PATH, isReadOnlyAttendanceUrl } from '../presensi/urls';
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
  /**
   * Session age log (lib/net/session-age.ts), dev and tester builds only:
   * told about outcomes after the fact. Never changes what is sent.
   */
  sessionAge?: { success(now: number): Promise<void>; expired(now: number): Promise<void> };
  /**
   * Mobile: a login answer alone never ends the session. After `wait()` (a
   * few seconds), one more small batch, core_session_time_remaining alone,
   * through the same gateway and budget, must say the same. Otherwise the
   * outcome is session_unconfirmed (a passing failure). Without it, the
   * first login answer ends the session (the extension).
   */
  confirmLogin?: { wait(): Promise<void> };
  /** Told once the session is over for sure (why: the codes of both answers). The vault follows it. */
  onSessionEnded?: (why: string) => Promise<void>;
}

export type CallResult = { ok: true; data: unknown } | { ok: false; errorcode: string };

/** Outcomes shared by JSON batches and HTML pages. */
export type TransportFailure =
  | { kind: 'refused'; reason: ClientRefusal }
  | { kind: 'login_required'; why?: string }
  /** SIKOLA answered "log in" once, and the second ask did not agree: a passing failure, the session stays. */
  | { kind: 'session_unconfirmed'; why: string }
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
        await noteSessionAge(deps, outcome.kind);
        return outcome;
      }),
    fetchPage: (path, options = {}) =>
      enqueue(async () => {
        const outcome = await executePage(deps, path, options);
        await recordTech(deps.store, { at: deps.clock.now(), fn: 'page', status: statusOf(outcome) }).catch(() => undefined);
        await noteSessionAge(deps, outcome.kind);
        return outcome;
      }),
  };
}

type ResolvedDeps = MoodleClientDeps & { scheduler: Scheduler };

/** A success or a logout seen by a request that was going to happen anyway. */
async function noteSessionAge(deps: MoodleClientDeps, kind: string): Promise<void> {
  if (!deps.sessionAge) return;
  const now = deps.clock.now();
  if (kind === 'ok') await deps.sessionAge.success(now).catch(() => undefined);
  else if (kind === 'login_required') await deps.sessionAge.expired(now).catch(() => undefined);
}

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
  if (outcome.kind === 'login_required') return settleLogin(deps, outcome, options);
  return outcome;
}

async function executePage(deps: ResolvedDeps, pathAndQuery: string, options: RequestOptions): Promise<PageOutcome> {
  const url = safeUrl(pathAndQuery, deps.baseUrl);
  if (!url || !isAllowedPage(url.pathname)) return refused('NOT_ALLOWLISTED');
  // Attendance: the read-only student view only (never take, sessions.php or a form).
  if (url.pathname === ATTENDANCE_PATH && !isReadOnlyAttendanceUrl(`${url.pathname}${url.search}`)) return refused('NOT_ALLOWLISTED');
  const gate = await checkGates(deps);
  if (gate) return gate;

  const sent = await send(deps, `${url.pathname}${url.search}`, { method: 'GET' }, options, 0);
  if (sent.kind !== 'response') return sent;

  const outcome = await interpretPage(sent.response);
  if (outcome.kind === 'login_required') return settleLogin(deps, outcome, options);
  return outcome;
}

/**
 * A login answer: the session ends here, or (confirmLogin) only when a
 * second, separate ask a few seconds later says the same.
 */
async function settleLogin(deps: ResolvedDeps, first: { kind: 'login_required'; why?: string }, options: RequestOptions): Promise<TransportFailure> {
  const why = first.why ?? 'login';
  if (deps.confirmLogin) {
    await deps.confirmLogin.wait();
    const again = await askSessionOnly(deps, options);
    await recordTech(deps.store, { at: deps.clock.now(), fn: 'confirm:core_session_time_remaining', status: statusOf(again) }).catch(() => undefined);
    if (again.kind !== 'login_required') return { kind: 'session_unconfirmed', why: `${why}>${again.kind}` };
    return endSession(deps, `${why}+${again.why ?? 'login'}`);
  }
  return endSession(deps, why);
}

async function endSession(deps: ResolvedDeps, why: string): Promise<TransportFailure> {
  await writeSession(deps.store, deps.clock, 'EXPIRED');
  await deps.onSessionEnded?.(why).catch(() => undefined);
  return { kind: 'login_required', why };
}

/** The confirming ask: core_session_time_remaining alone, budgeted like any batch. */
async function askSessionOnly(deps: ResolvedDeps, options: RequestOptions): Promise<BatchOutcome> {
  const sesskey = await deps.getSesskey();
  if (!sesskey) return refused('NO_SESSKEY');
  const only = [calls.sessionTimeRemaining()];
  const sent = await send(
    deps,
    batchPath(sesskey, deps.noSessionUpdate),
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(only.map((c, index) => ({ index, methodname: c.methodname, args: c.args }))) },
    options,
    1,
  );
  if (sent.kind !== 'response') return sent;
  return interpretBatch(sent.response, only);
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
  if (isRedirect(response)) return { kind: 'login_required', why: 'redirect' };
  if (!response.ok) return { kind: 'http_error', status: response.status };

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) return { kind: 'login_required', why: 'html' };
  if (!contentType.includes('json')) return { kind: 'bad_response', detail: `content-type ${contentType || 'missing'}` };

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { kind: 'bad_response', detail: 'invalid json' };
  }

  const topLevel = topLevelErrorSchema.safeParse(json);
  if (topLevel.success) return classifyError(topLevel.data.errorcode, 'top');

  const parsed = batchResponseSchema.safeParse(json);
  if (!parsed.success) return { kind: 'bad_response', detail: 'schema mismatch' };

  const results: CallResult[] = parsed.data.map((item) =>
    item.error ? { ok: false, errorcode: item.exception.errorcode } : { ok: true, data: item.data },
  );
  // The session call decides first: Moodle stops a batch at its first error,
  // so a session call that failed is often the only answer there is.
  const sessionIndex = calls.findIndex((c) => c.methodname === 'core_session_time_remaining');
  const session = sessionIndex >= 0 ? results[sessionIndex] : undefined;
  if (session && !session.ok && (LOGIN_ERRORCODES.has(session.errorcode) || SESSKEY_ERRORCODES.has(session.errorcode))) {
    return classifyError(session.errorcode, 'session');
  }
  if (results.length !== expected) return { kind: 'bad_response', detail: 'length mismatch' };
  return { kind: 'ok', results };
}

async function interpretPage(response: Response): Promise<PageOutcome> {
  if (isRedirect(response)) return { kind: 'login_required', why: 'page_redirect' };
  if (!response.ok) return { kind: 'http_error', status: response.status };
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) return { kind: 'bad_response', detail: `content-type ${contentType || 'missing'}` };
  try {
    return { kind: 'ok', html: await response.text() };
  } catch {
    return { kind: 'bad_response', detail: 'unreadable body' };
  }
}

function classifyError(errorcode: string, where: 'top' | 'session'): BatchOutcome {
  if (LOGIN_ERRORCODES.has(errorcode)) return { kind: 'login_required', why: `${where}:${errorcode}` };
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
