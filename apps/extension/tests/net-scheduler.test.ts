import { describe, expect, it } from 'vitest';
import { afterFailure, BACKOFF_KEY, jitteredDelaySeconds } from '@sulo/core/moodle/backoff';
import { DOMAINS, domainOf } from '@sulo/core/net/domains';
import { KNOWN_MUTATING_PATHS, READ_PATHS, SIPAKAMASE_ORIGIN } from '@sulo/core/sipakamase/allowlist';
import { appendRequestLog, REQUEST_LOG_MAX } from '@sulo/core/net/request-log';
import { createScheduler, type RequestLogEntry } from '@sulo/core/net/scheduler';
import { fakeFetch, fixedClock, jsonResponse, memoryStore } from './helpers';

const NOW = 1_794_000_000;
const H = 3600;
const SIKOLA = 'https://sikola-v2.unhas.ac.id/lib/ajax/service.php?sesskey=SESSKEY999';
const DATA = 'https://ikrar06.github.io/sulo-data/config.json';

function setup(respond: () => Response = () => jsonResponse({}), random?: () => number) {
  const store = memoryStore();
  const fetch = fakeFetch(respond);
  const log: RequestLogEntry[] = [];
  const scheduler = createScheduler({ fetch, store, clock: fixedClock('2026-11-13', 10, NOW), random, onRequest: (e) => void log.push(e) });
  return { scheduler, store, fetch, log };
}

describe('domains', () => {
  it('knows exactly four domains and matches origins exactly', () => {
    expect(domainOf(SIKOLA)).toBe('sikola');
    expect(domainOf(DATA)).toBe('sulo-data');
    expect(domainOf('https://api.neosia.unhas.ac.id/x')).toBe('neosia');
    expect(domainOf('https://sipakamase.unhas.ac.id/cklaim/content')).toBe('sipakamase');
    expect(domainOf('https://sipakamase.unhas.ac.id.evil.test/')).toBeNull();
    expect(Object.keys(DOMAINS)).toHaveLength(4);
    expect(domainOf('https://sikola-v2.unhas.ac.id.evil.test/')).toBeNull();
    expect(domainOf('http://sikola-v2.unhas.ac.id/')).toBeNull();
    expect(domainOf('not a url')).toBeNull();
  });

  it('NEOSIA refuses every request (rule 12)', () => {
    expect(DOMAINS.neosia.allowRequests).toBe(false);
  });
});

describe('scheduler gates', () => {
  it('refuses NEOSIA without calling fetch', async () => {
    const { scheduler, fetch, log } = setup();
    expect(await scheduler.request('neosia', 'https://api.neosia.unhas.ac.id/mahasiswa', { method: 'GET' }, { trigger: 'test' })).toEqual({
      kind: 'refused',
      reason: 'DOMAIN_DENIED',
    });
    expect(fetch.calls).toHaveLength(0);
    expect(log).toHaveLength(0);
  });

  it('refuses a URL that is not on the named domain', async () => {
    const { scheduler, fetch } = setup();
    expect(await scheduler.request('sulo-data', 'https://example.test/config.json', { method: 'GET' }, { trigger: 'test' })).toEqual({
      kind: 'refused',
      reason: 'NOT_ALLOWLISTED',
    });
    expect(await scheduler.request('sikola', DATA, { method: 'GET' }, { trigger: 'test' })).toMatchObject({ reason: 'NOT_ALLOWLISTED' });
    expect(fetch.calls).toHaveLength(0);
  });

  it('applies each domain its fixed options: SIKOLA with cookies, sulo-data without cookies or headers', async () => {
    const { scheduler, fetch } = setup();
    await scheduler.request('sikola', SIKOLA, { method: 'POST', credentials: 'omit' }, { trigger: 'test' });
    await scheduler.request('sulo-data', DATA, { method: 'GET' }, { trigger: 'test' });
    expect(fetch.calls[0]?.init).toMatchObject({ credentials: 'include', redirect: 'manual' });
    expect(fetch.calls[1]?.init).toMatchObject({ credentials: 'omit', cache: 'no-cache' });
    expect(fetch.calls[1]?.init?.headers).toBeUndefined();
  });

  it('refuses with BUDGET_EXHAUSTED when the reservation fails, before fetch', async () => {
    const { scheduler, fetch } = setup();
    expect(await scheduler.request('sikola', SIKOLA, {}, { trigger: 'test', reserve: async () => false })).toMatchObject({ reason: 'BUDGET_EXHAUSTED' });
    expect(fetch.calls).toHaveLength(0);
  });
});

describe('backoff per domain', () => {
  it('a sulo-data failure never blocks SIKOLA, and the reverse', async () => {
    const { scheduler, store, fetch } = setup(() => new Response('', { status: 503 }));
    await scheduler.request('sulo-data', DATA, {}, { trigger: 'test' });
    expect(store.dump()['global:backoff:sulo-data']).toMatchObject({ failures: 1 });
    expect(store.dump()[BACKOFF_KEY]).toBeUndefined();
    await scheduler.request('sikola', SIKOLA, {}, { trigger: 'test' });
    expect(fetch.calls).toHaveLength(2);
    expect(await scheduler.request('sulo-data', DATA, {}, { trigger: 'test' })).toMatchObject({ reason: 'BACKING_OFF' });
    expect(fetch.calls).toHaveLength(2);
  });

  it('jitter keeps each step between half and the full delay (not full jitter)', () => {
    expect(jitteredDelaySeconds(1, () => 0)).toBe(1.5 * H);
    expect(jitteredDelaySeconds(1, () => 1)).toBe(3 * H);
    expect(jitteredDelaySeconds(2, () => 0.5)).toBe(4.5 * H);
    expect(jitteredDelaySeconds(4, () => 0)).toBe(12 * H);
    for (let i = 0; i < 50; i++) {
      const d = jitteredDelaySeconds(3, Math.random);
      expect(d).toBeGreaterThanOrEqual(6 * H);
      expect(d).toBeLessThanOrEqual(12 * H);
    }
  });

  it('Retry-After only extends the jittered wait, capped at 24 hours', () => {
    expect(afterFailure({ failures: 0, nextAllowedAt: 0 }, NOW, 60, () => 0).nextAllowedAt).toBe(NOW + 1.5 * H);
    expect(afterFailure({ failures: 0, nextAllowedAt: 0 }, NOW, 5 * H, () => 0).nextAllowedAt).toBe(NOW + 5 * H);
    expect(afterFailure({ failures: 0, nextAllowedAt: 0 }, NOW, 99 * H, () => 0).nextAllowedAt).toBe(NOW + 24 * H);
  });

  it('the scheduler passes its random source to the backoff', async () => {
    const { scheduler, store } = setup(() => new Response('', { status: 500 }), () => 0);
    await scheduler.request('sikola', SIKOLA, {}, { trigger: 'test' });
    expect(store.dump()[BACKOFF_KEY]).toEqual({ failures: 1, nextAllowedAt: NOW + 1.5 * H });
  });
});

describe('serial queue per domain', () => {
  it('never runs two requests to the same domain at once', async () => {
    let active = 0;
    let peak = 0;
    const store = memoryStore();
    const scheduler = createScheduler({
      store,
      clock: fixedClock('2026-11-13', 10, NOW),
      fetch: async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active -= 1;
        return jsonResponse({});
      },
    });
    await Promise.all([1, 2, 3].map(() => scheduler.request('sikola', SIKOLA, {}, { trigger: 'test' })));
    expect(peak).toBe(1);
  });
});

describe('request log (dev and tester builds)', () => {
  it('records path without the query (no sesskey), trigger, calls, size and outcome', async () => {
    const { scheduler, log } = setup(() => jsonResponse({ a: 1 }));
    await scheduler.request('sikola', SIKOLA, {}, { trigger: 'background', calls: 4 });
    expect(log).toEqual([{ at: NOW, domain: 'sikola', path: '/lib/ajax/service.php', trigger: 'background', calls: 4, bytes: 7, outcome: 'http 200' }]);
    expect(JSON.stringify(log)).not.toContain('SESSKEY999');
  });

  it('keeps the newest 100 entries', () => {
    let log: RequestLogEntry[] = [];
    for (let i = 0; i < 130; i++) log = appendRequestLog(log, { at: i, domain: 'sikola', path: '/', trigger: 't', calls: 0, bytes: 0, outcome: 'ok' });
    expect(log).toHaveLength(REQUEST_LOG_MAX);
    expect(log[0]?.at).toBe(129);
  });

  it('measures nothing when no logger is attached (production)', async () => {
    const store = memoryStore();
    const scheduler = createScheduler({ fetch: fakeFetch(() => jsonResponse({})), store, clock: fixedClock() });
    await scheduler.request('sikola', SIKOLA, {}, { trigger: 'test' });
    expect(store.dump()['global:requestLog']).toBeUndefined();
  });
});

describe('Sipakamase: read-only paths only (1.1.0)', () => {
  const at = (path: string) => `${SIPAKAMASE_ORIGIN}${path}`;
  const withCredentials = (url: string) => {
    const u = new URL(url);
    u.username = 'u';
    u.password = 'p';
    return u.href;
  };

  it('sends a plain GET to each of the five fragments, with the session cookie and no cache, never following a redirect', async () => {
    const { scheduler, fetch } = setup(() => new Response('<table></table>', { status: 200 }));
    for (const path of READ_PATHS) expect((await scheduler.request('sipakamase', at(path), { method: 'GET' }, { trigger: 'test' })).kind).toBe('response');
    expect(fetch.calls).toHaveLength(5);
    expect(fetch.calls[0]!.init).toMatchObject({ credentials: 'include', redirect: 'manual', cache: 'no-store' });
  });

  it('refuses every address that changes data or ends the session, without calling fetch', async () => {
    const { scheduler, fetch } = setup();
    for (const path of KNOWN_MUTATING_PATHS) {
      expect(await scheduler.request('sipakamase', at(path), { method: 'GET' }, { trigger: 'test' })).toEqual({ kind: 'refused', reason: 'NOT_ALLOWLISTED' });
    }
    expect(fetch.calls).toHaveLength(0);
  });

  it('refuses a query, a fragment, a trailing slash, another method or a body on an allowed path', async () => {
    const { scheduler, fetch } = setup();
    const path = READ_PATHS[0];
    for (const [url, init] of [
      [at(`${path}?x=1`), { method: 'GET' }],
      [at(`${path}#a`), { method: 'GET' }],
      [at(`${path}/`), { method: 'GET' }],
      [at(`${path}/x.y`), { method: 'GET' }],
      [at(path.toUpperCase()), { method: 'GET' }],
      [at(path), { method: 'POST' }],
      [at(path), { method: 'GET', body: 'a=1' }],
      [withCredentials(at(path)), { method: 'GET' }],
    ] as [string, RequestInit][]) {
      expect(await scheduler.request('sipakamase', url, init, { trigger: 'test' })).toEqual({ kind: 'refused', reason: 'NOT_ALLOWLISTED' });
    }
    expect(fetch.calls).toHaveLength(0);
  });
});
