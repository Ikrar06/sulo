import { describe, expect, it } from 'vitest';
import { createMoodleClient, type MoodleClientDeps } from '@sulo/core/moodle/client';
import { BUDGET_KEY } from '@sulo/core/moodle/budget';
import { fakeFetch, fixedClock, jsonResponse, memoryStore } from './helpers';

const BASE = 'https://sikola-v2.unhas.ac.id';
const SESSKEY = 'SESSKEY123';
const sessionCall = { methodname: 'core_session_time_remaining', args: {} };

function setup(overrides: Partial<MoodleClientDeps> = {}) {
  const store = memoryStore();
  const fetch = fakeFetch(() => jsonResponse([{ error: false, data: { userid: 7, timeremaining: 100 } }]));
  const deps: MoodleClientDeps = {
    fetch,
    store,
    clock: fixedClock(),
    baseUrl: BASE,
    getSesskey: async () => SESSKEY,
    ...overrides,
  };
  return { client: createMoodleClient(deps), store, fetch: deps.fetch as typeof fetch };
}

describe('moodle client: request shape', () => {
  it('posts a JSON batch to service.php with credentials and manual redirect', async () => {
    const { client, fetch } = setup();
    const outcome = await client.callBatch([sessionCall]);

    expect(outcome).toEqual({ kind: 'ok', results: [{ ok: true, data: { userid: 7, timeremaining: 100 } }] });
    expect(fetch.calls).toHaveLength(1);
    const [call] = fetch.calls;
    // nosessionupdate: Sulo's checks must not keep the SIKOLA session alive (Stage 1, item 9).
    expect(call?.url).toBe(`${BASE}/lib/ajax/service.php?sesskey=${SESSKEY}&nosessionupdate=true`);
    expect(call?.init?.method).toBe('POST');
    expect(call?.init?.credentials).toBe('include');
    expect(call?.init?.redirect).toBe('manual');
    expect(JSON.parse(String(call?.init?.body))).toEqual([
      { index: 0, methodname: 'core_session_time_remaining', args: {} },
    ]);
  });

  it('leaves nosessionupdate out only when switched off (for verification)', async () => {
    const { client, fetch } = setup({ noSessionUpdate: false });
    await client.callBatch([sessionCall]);
    expect(fetch.calls[0]?.url).toBe(`${BASE}/lib/ajax/service.php?sesskey=${SESSKEY}`);
  });

  it('counts function calls separately from requests and refuses past 300 calls', async () => {
    const { client, store, fetch } = setup({ dailyCallBudget: 3 });
    expect((await client.callBatch([sessionCall, sessionCall])).kind).toBe('bad_response'); // 2 calls, 1-result body
    expect((store.dump()['global:budget'] as { used: number; calls: number })).toMatchObject({ used: 1, calls: 2 });
    expect(await client.callBatch([sessionCall, sessionCall])).toEqual({ kind: 'refused', reason: 'BUDGET_EXHAUSTED' });
    expect(fetch.calls).toHaveLength(1);
  });
});

describe('moodle client: refusals', () => {
  it('refuses functions outside the allowlist without sending anything', async () => {
    const { client, fetch } = setup();
    const outcome = await client.callBatch([{ methodname: 'core_message_mark_all_notifications_as_read', args: {} }]);
    expect(outcome).toEqual({ kind: 'refused', reason: 'NOT_ALLOWLISTED' });
    expect(fetch.calls).toHaveLength(0);
  });

  it('refuses a batch where only one call is outside the allowlist', async () => {
    const { client, fetch } = setup();
    const outcome = await client.callBatch([sessionCall, { methodname: 'core_session_touch', args: {} }]);
    expect(outcome).toEqual({ kind: 'refused', reason: 'NOT_ALLOWLISTED' });
    expect(fetch.calls).toHaveLength(0);
  });

  it('refuses when there is no sesskey and does not spend budget', async () => {
    const { client, fetch, store } = setup({ getSesskey: async () => null });
    expect(await client.callBatch([sessionCall])).toEqual({ kind: 'refused', reason: 'NO_SESSKEY' });
    expect(fetch.calls).toHaveLength(0);
    expect(store.dump()[BUDGET_KEY]).toBeUndefined();
  });

  it('refuses once the daily budget is used up', async () => {
    const { client, fetch } = setup({ dailyBudget: 2 });
    await client.callBatch([sessionCall]);
    await client.callBatch([sessionCall]);
    expect(await client.callBatch([sessionCall])).toEqual({ kind: 'refused', reason: 'BUDGET_EXHAUSTED' });
    expect(fetch.calls).toHaveLength(2);
  });
});

describe('moodle client: serial queue', () => {
  it('never runs two requests at the same time', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetch = fakeFetch(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return jsonResponse([{ error: false, data: { userid: 7, timeremaining: 1 } }]);
    });
    const { client } = setup({ fetch });

    await Promise.all([client.callBatch([sessionCall]), client.callBatch([sessionCall]), client.callBatch([sessionCall])]);
    expect(fetch.calls).toHaveLength(3);
    expect(maxInFlight).toBe(1);
  });

  it('keeps the queue alive after a failed request', async () => {
    let first = true;
    const fetch = fakeFetch(() => {
      if (first) {
        first = false;
        return new Response('not json', { headers: { 'content-type': 'application/json' } });
      }
      return jsonResponse([{ error: false, data: {} }]);
    });
    const { client } = setup({ fetch });
    expect(await client.callBatch([sessionCall])).toEqual({ kind: 'bad_response', detail: 'invalid json' });
    expect((await client.callBatch([sessionCall])).kind).toBe('ok');
  });
});

describe('moodle client: response interpretation', () => {
  it('treats an opaque redirect as login required', async () => {
    const redirect = Object.defineProperty(new Response(null, { status: 200 }), 'type', { value: 'opaqueredirect' });
    const { client } = setup({ fetch: fakeFetch(() => redirect) });
    expect(await client.callBatch([sessionCall])).toMatchObject({ kind: 'login_required' });
  });

  it('treats an HTML page as login required', async () => {
    const html = new Response('<html><form id="login"></form></html>', { headers: { 'content-type': 'text/html' } });
    const { client } = setup({ fetch: fakeFetch(() => html) });
    expect(await client.callBatch([sessionCall])).toMatchObject({ kind: 'login_required' });
  });

  it('maps servicerequireslogin inside the batch to login required', async () => {
    const fetch = fakeFetch(() => jsonResponse([{ error: true, exception: { errorcode: 'servicerequireslogin', message: 'x' } }]));
    const { client } = setup({ fetch });
    expect(await client.callBatch([sessionCall])).toMatchObject({ kind: 'login_required' });
  });

  it('maps a top-level invalidsesskey error', async () => {
    const fetch = fakeFetch(() => jsonResponse({ error: 'x', errorcode: 'invalidsesskey' }));
    const { client } = setup({ fetch });
    expect(await client.callBatch([sessionCall])).toEqual({ kind: 'invalid_sesskey' });
  });

  it('keeps other per-call errors as results', async () => {
    const fetch = fakeFetch(() =>
      jsonResponse([
        { error: false, data: { userid: 7, timeremaining: 1 } },
        { error: true, exception: { errorcode: 'servicenotavailable', message: 'x' } },
      ]),
    );
    const { client } = setup({ fetch });
    const outcome = await client.callBatch([sessionCall, { methodname: 'core_courseformat_get_state', args: { courseid: 1 } }]);
    expect(outcome).toEqual({
      kind: 'ok',
      results: [
        { ok: true, data: { userid: 7, timeremaining: 1 } },
        { ok: false, errorcode: 'servicenotavailable' },
      ],
    });
  });

  it('reports HTTP errors with their status', async () => {
    const { client } = setup({ fetch: fakeFetch(() => new Response('', { status: 503 })) });
    expect(await client.callBatch([sessionCall])).toEqual({ kind: 'http_error', status: 503 });
  });

  it('reports a schema mismatch as bad response, never as empty data', async () => {
    const { client } = setup({ fetch: fakeFetch(() => jsonResponse({ unexpected: true })) });
    expect((await client.callBatch([sessionCall])).kind).toBe('bad_response');
  });

  it('reports a result count mismatch as bad response', async () => {
    const { client } = setup({ fetch: fakeFetch(() => jsonResponse([])) });
    expect(await client.callBatch([sessionCall])).toEqual({ kind: 'bad_response', detail: 'length mismatch' });
  });

  it('reports a timeout distinctly from a network error', async () => {
    const fetch = fakeFetch(() => {
      throw new DOMException('timed out', 'TimeoutError');
    });
    const { client } = setup({ fetch });
    expect(await client.callBatch([sessionCall])).toEqual({ kind: 'timeout' });
  });
});
