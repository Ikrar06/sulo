import { describe, expect, it } from 'vitest';
import { BACKOFF_KEY } from '@sulo/core/moodle/backoff';
import { BUDGET_KEY } from '@sulo/core/moodle/budget';
import { createMoodleClient, type MoodleClientDeps } from '@sulo/core/moodle/client';
import { SESSION_KEY } from '@sulo/core/moodle/session';
import { REMOTE_CONFIG_KEY } from '@sulo/core/remote/remote-config';
import { fakeFetch, fixedClock, jsonResponse, memoryStore } from './helpers';

const BASE = 'https://sikola-v2.unhas.ac.id';
const NOW = 1_794_000_000;
const sessionCall = { methodname: 'core_session_time_remaining', args: {} };
const okBody = () => jsonResponse([{ error: false, data: { userid: 7, timeremaining: 100 } }]);
const htmlPage = (body = '<html></html>') => new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } });

function setup(initial: Record<string, unknown> = {}, overrides: Partial<MoodleClientDeps> = {}) {
  const store = memoryStore(initial);
  const fetch = fakeFetch(okBody);
  const deps: MoodleClientDeps = {
    fetch,
    store,
    clock: fixedClock('2026-11-13', 10, NOW),
    baseUrl: BASE,
    getSesskey: async () => 'SESSKEY001',
    ...overrides,
  };
  return { client: createMoodleClient(deps), store, fetch: deps.fetch as typeof fetch };
}

describe('kill switch', () => {
  it('blocks every request when the remote config says enabled: false', async () => {
    const { client, fetch, store } = setup({
      [REMOTE_CONFIG_KEY]: { enabled: false, minIntervalMinutes: 180, message: 'x', fetchedAt: NOW },
    });
    expect(await client.callBatch([sessionCall])).toEqual({ kind: 'refused', reason: 'DISABLED_REMOTELY' });
    expect(await client.fetchPage('/my/')).toEqual({ kind: 'refused', reason: 'DISABLED_REMOTELY' });
    expect(fetch.calls).toHaveLength(0);
    expect(store.dump()[BUDGET_KEY]).toBeUndefined();
  });
});

describe('session expired', () => {
  it('refuses all requests while the session is EXPIRED', async () => {
    const { client, fetch } = setup({ [SESSION_KEY]: { state: 'EXPIRED', userId: 7, checkedAt: NOW } });
    expect(await client.callBatch([sessionCall])).toEqual({ kind: 'refused', reason: 'SESSION_EXPIRED' });
    expect(await client.fetchPage('/my/')).toEqual({ kind: 'refused', reason: 'SESSION_EXPIRED' });
    expect(fetch.calls).toHaveLength(0);
  });

  it('sets EXPIRED on a login redirect and then stops sending', async () => {
    const redirect = Object.defineProperty(new Response(null), 'type', { value: 'opaqueredirect' });
    const { client, fetch, store } = setup({}, { fetch: fakeFetch(() => redirect) });
    expect(await client.callBatch([sessionCall])).toMatchObject({ kind: 'login_required' });
    expect((store.dump()[SESSION_KEY] as { state: string }).state).toBe('EXPIRED');
    expect(await client.callBatch([sessionCall])).toEqual({ kind: 'refused', reason: 'SESSION_EXPIRED' });
    expect(fetch.calls).toHaveLength(1);
  });

  it('does not count a login redirect as a backoff failure', async () => {
    const redirect = Object.defineProperty(new Response(null), 'type', { value: 'opaqueredirect' });
    const { client, store } = setup({}, { fetch: fakeFetch(() => redirect) });
    await client.callBatch([sessionCall]);
    expect(store.dump()[BACKOFF_KEY]).toBeUndefined();
  });
});

describe('backoff in the client', () => {
  it.each([
    ['429', () => new Response('', { status: 429 })],
    ['503', () => new Response('', { status: 503 })],
    ['network', () => { throw new TypeError('Failed to fetch'); }],
    ['timeout', () => { throw new DOMException('t', 'TimeoutError'); }],
  ])('a %s failure starts a 3 h backoff and blocks the next request', async (_label, respond) => {
    const { client, fetch, store } = setup({}, { fetch: fakeFetch(respond as () => Response) });
    await client.callBatch([sessionCall]);
    expect(store.dump()[BACKOFF_KEY]).toEqual({ failures: 1, nextAllowedAt: NOW + 3 * 3600 });
    expect(await client.callBatch([sessionCall])).toEqual({ kind: 'refused', reason: 'BACKING_OFF' });
    expect(fetch.calls).toHaveLength(1);
  });

  it('honours a longer Retry-After header', async () => {
    const respond = () => new Response('', { status: 429, headers: { 'retry-after': String(5 * 3600) } });
    const { client, store } = setup({}, { fetch: fakeFetch(respond) });
    await client.callBatch([sessionCall]);
    expect(store.dump()[BACKOFF_KEY]).toEqual({ failures: 1, nextAllowedAt: NOW + 5 * 3600 });
  });

  it('allows a request again once the backoff has passed, and success resets it', async () => {
    const { client, store } = setup({ [BACKOFF_KEY]: { failures: 2, nextAllowedAt: NOW - 1 } });
    expect((await client.callBatch([sessionCall])).kind).toBe('ok');
    expect(store.dump()[BACKOFF_KEY]).toEqual({ failures: 0, nextAllowedAt: 0 });
  });

  it('does not back off on a 404', async () => {
    const { client, store } = setup({}, { fetch: fakeFetch(() => new Response('', { status: 404 })) });
    expect(await client.callBatch([sessionCall])).toEqual({ kind: 'http_error', status: 404 });
    expect(store.dump()[BACKOFF_KEY]).toBeUndefined();
  });
});

describe('fetchPage', () => {
  it('fetches an allowlisted page with GET, cookies and manual redirect', async () => {
    const { client, fetch } = setup({}, { fetch: fakeFetch(() => htmlPage('<html>ok</html>')) });
    expect(await client.fetchPage('/my/')).toEqual({ kind: 'ok', html: '<html>ok</html>' });
    const call = fetch.calls[0];
    expect(call?.url).toBe(`${BASE}/my/`);
    expect(call?.init?.method).toBe('GET');
    expect(call?.init?.credentials).toBe('include');
    expect(call?.init?.redirect).toBe('manual');
  });

  it.each(['/login/logout.php', '/mod/quiz/view.php?id=1', 'https://example.test/my/', '/my/index.php'])(
    'refuses %s',
    async (path) => {
      const { client, fetch } = setup();
      expect(await client.fetchPage(path)).toEqual({ kind: 'refused', reason: 'NOT_ALLOWLISTED' });
      expect(fetch.calls).toHaveLength(0);
    },
  );

  it('counts pages against the same daily budget', async () => {
    const { client } = setup({}, { fetch: fakeFetch(() => htmlPage()), dailyBudget: 1 });
    expect((await client.fetchPage('/my/')).kind).toBe('ok');
    expect(await client.callBatch([sessionCall])).toEqual({ kind: 'refused', reason: 'BUDGET_EXHAUSTED' });
  });

  it('does not need a sesskey', async () => {
    const { client } = setup({}, { fetch: fakeFetch(() => htmlPage()), getSesskey: async () => null });
    expect((await client.fetchPage('/my/')).kind).toBe('ok');
  });
});
