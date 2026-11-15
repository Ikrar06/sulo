// The single gateway for every request to SIKOLA (project rules: one gateway, never parallel).
// Pure module: fetch, storage, clock and sesskey are injected.
//
// Every request passes the same gates, in order: allowlist, remote kill
// switch, session not EXPIRED, not backing off, (sesskey for JSON), budget.
// The budget is reserved before sending. Failures that suggest server
// trouble feed the backoff; a login redirect sets the session EXPIRED.

import type { ClientRefusal, Clock, FetchLike, KeyValueStore } from '../types';
import { readRemoteConfig } from '../remote-config';
import { isBackingOff, parseRetryAfter, readBackoff, recordFailure, recordSuccess } from './backoff';
import { reserveRequest } from './budget';
import { isAllowedFunction, isAllowedPage, type MoodleCall } from './calls';
import { DAILY_BUDGET, REQUEST_TIMEOUT_MS } from './limits';
import { batchResponseSchema, topLevelErrorSchema } from './schemas';
import { readSession, writeSession } from './session';

export interface MoodleClientDeps {
  fetch: FetchLike;
  store: KeyValueStore;
  clock: Clock;
  baseUrl: string;
  getSesskey: () => Promise<string | null>;
  dailyBudget?: number;
  timeoutMs?: number;
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

export interface MoodleClient {
  callBatch(calls: readonly MoodleCall[]): Promise<BatchOutcome>;
  /** GET an allowlisted HTML page, e.g. "/my/". Only on user request. */
  fetchPage(pathAndQuery: string): Promise<PageOutcome>;
}

const LOGIN_ERRORCODES = new Set(['servicerequireslogin', 'requireloginerror']);
const SESSKEY_ERRORCODES = new Set(['invalidsesskey']);

export function createMoodleClient(deps: MoodleClientDeps): MoodleClient {
  // Promise chain that serializes requests within this context. It holds no
  // data, only ordering, so losing it on service worker restart is harmless.
  let tail: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task);
    tail = run.catch(() => undefined);
    return run;
  };

  return {
    callBatch: (calls) => enqueue(() => executeBatch(deps, calls)),
    fetchPage: (path) => enqueue(() => executePage(deps, path)),
  };
}

async function executeBatch(deps: MoodleClientDeps, calls: readonly MoodleCall[]): Promise<BatchOutcome> {
  if (calls.length === 0 || !calls.every((c) => isAllowedFunction(c.methodname))) {
    return refused('NOT_ALLOWLISTED');
  }
  const gate = await checkGates(deps);
  if (gate) return gate;

  const sesskey = await deps.getSesskey();
  if (!sesskey) return refused('NO_SESSKEY');

  const sent = await send(deps, `/lib/ajax/service.php?sesskey=${encodeURIComponent(sesskey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(calls.map((c, index) => ({ index, methodname: c.methodname, args: c.args }))),
  });
  if (sent.kind !== 'response') return sent;

  const outcome = await interpretBatch(sent.response, calls.length);
  if (outcome.kind === 'login_required') await writeSession(deps.store, deps.clock, 'EXPIRED');
  return outcome;
}

async function executePage(deps: MoodleClientDeps, pathAndQuery: string): Promise<PageOutcome> {
  const url = safeUrl(pathAndQuery, deps.baseUrl);
  if (!url || !isAllowedPage(url.pathname)) return refused('NOT_ALLOWLISTED');
  const gate = await checkGates(deps);
  if (gate) return gate;

  const sent = await send(deps, `${url.pathname}${url.search}`, { method: 'GET' });
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

/** Reserves budget, sends, and records backoff. The only place that calls fetch. */
async function send(deps: MoodleClientDeps, path: string, init: RequestInit): Promise<SendResult> {
  if (!(await reserveRequest(deps.store, deps.clock, deps.dailyBudget ?? DAILY_BUDGET))) {
    return refused('BUDGET_EXHAUSTED');
  }

  let response: Response;
  try {
    response = await deps.fetch(`${deps.baseUrl}${path}`, {
      ...init,
      credentials: 'include',
      // A redirect means the session is gone (login page). Following it to
      // another host would surface as a CORS/network error instead.
      redirect: 'manual',
      signal: AbortSignal.timeout(deps.timeoutMs ?? REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    await recordFailure(deps.store, deps.clock, null);
    return isTimeoutError(error) ? { kind: 'timeout' } : { kind: 'network_error' };
  }

  if (response.status === 429 || response.status >= 500) {
    const retryAfter = parseRetryAfter(response.headers.get('retry-after'), deps.clock.now());
    await recordFailure(deps.store, deps.clock, retryAfter);
    return { kind: 'http_error', status: response.status };
  }
  await recordSuccess(deps.store);
  return { kind: 'response', response };
}

function isRedirect(response: Response): boolean {
  return response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400);
}

async function interpretBatch(response: Response, expected: number): Promise<BatchOutcome> {
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
  for (const r of results) {
    if (!r.ok && (LOGIN_ERRORCODES.has(r.errorcode) || SESSKEY_ERRORCODES.has(r.errorcode))) {
      return classifyError(r.errorcode);
    }
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

function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');
}
