// The single gateway for every request to SIKOLA (CLAUDE.md, hard rules 2 and 3).
// Pure module: fetch, storage, clock and sesskey are injected.
//
// M0 scope: allowlist, serial queue, daily budget, timeout, login detection.
// M1 adds backoff, EXPIRED/remote-config refusals and the full error matrix.

import type { ClientRefusal, Clock, FetchLike, KeyValueStore } from '../types';
import { isAllowedFunction, type MoodleCall } from './calls';
import { reserveRequest } from './budget';
import { DAILY_BUDGET, REQUEST_TIMEOUT_MS } from './limits';
import { batchResponseSchema, topLevelErrorSchema } from './schemas';

export interface MoodleClientDeps {
  fetch: FetchLike;
  store: KeyValueStore;
  clock: Clock;
  baseUrl: string;
  getSesskey: () => Promise<string | null>;
  dailyBudget?: number;
  timeoutMs?: number;
}

export type CallResult =
  | { ok: true; data: unknown }
  | { ok: false; errorcode: string };

export type BatchOutcome =
  | { kind: 'ok'; results: CallResult[] }
  | { kind: 'refused'; reason: ClientRefusal }
  | { kind: 'login_required' }
  | { kind: 'invalid_sesskey' }
  | { kind: 'network_error' }
  | { kind: 'timeout' }
  | { kind: 'http_error'; status: number }
  | { kind: 'bad_response'; detail: string };

export interface MoodleClient {
  callBatch(calls: readonly MoodleCall[]): Promise<BatchOutcome>;
}

const LOGIN_ERRORCODES = new Set(['servicerequireslogin', 'requireloginerror']);
const SESSKEY_ERRORCODES = new Set(['invalidsesskey']);

export function createMoodleClient(deps: MoodleClientDeps): MoodleClient {
  // Promise chain that serializes requests within this context. It holds no
  // data, only ordering, so losing it on service worker restart is harmless.
  let tail: Promise<unknown> = Promise.resolve();

  const callBatch = (calls: readonly MoodleCall[]): Promise<BatchOutcome> => {
    const run = tail.then(() => executeBatch(deps, calls));
    tail = run.catch(() => undefined);
    return run;
  };

  return { callBatch };
}

async function executeBatch(
  deps: MoodleClientDeps,
  calls: readonly MoodleCall[],
): Promise<BatchOutcome> {
  if (calls.length === 0 || !calls.every((c) => isAllowedFunction(c.methodname))) {
    return { kind: 'refused', reason: 'NOT_ALLOWLISTED' };
  }

  const sesskey = await deps.getSesskey();
  if (!sesskey) return { kind: 'refused', reason: 'NO_SESSKEY' };

  const reserved = await reserveRequest(deps.store, deps.clock, deps.dailyBudget ?? DAILY_BUDGET);
  if (!reserved) return { kind: 'refused', reason: 'BUDGET_EXHAUSTED' };

  const url = `${deps.baseUrl}/lib/ajax/service.php?sesskey=${encodeURIComponent(sesskey)}`;
  const body = JSON.stringify(
    calls.map((c, index) => ({ index, methodname: c.methodname, args: c.args })),
  );

  let response: Response;
  try {
    response = await deps.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      // A redirect means the session is gone (login page). Following it to
      // another host would surface as a CORS/network error instead.
      redirect: 'manual',
      body,
      signal: AbortSignal.timeout(deps.timeoutMs ?? REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    return isTimeoutError(error) ? { kind: 'timeout' } : { kind: 'network_error' };
  }

  return interpretResponse(response, calls.length);
}

async function interpretResponse(response: Response, expected: number): Promise<BatchOutcome> {
  if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
    return { kind: 'login_required' };
  }
  if (!response.ok) return { kind: 'http_error', status: response.status };

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) return { kind: 'login_required' };
  if (!contentType.includes('json')) {
    return { kind: 'bad_response', detail: `content-type ${contentType || 'missing'}` };
  }

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

  const sessionFailure = results.find(
    (r) => !r.ok && (LOGIN_ERRORCODES.has(r.errorcode) || SESSKEY_ERRORCODES.has(r.errorcode)),
  );
  if (sessionFailure && !sessionFailure.ok) return classifyError(sessionFailure.errorcode);

  return { kind: 'ok', results };
}

function classifyError(errorcode: string): BatchOutcome {
  if (LOGIN_ERRORCODES.has(errorcode)) return { kind: 'login_required' };
  if (SESSKEY_ERRORCODES.has(errorcode)) return { kind: 'invalid_sesskey' };
  return { kind: 'bad_response', detail: `errorcode ${errorcode}` };
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');
}
