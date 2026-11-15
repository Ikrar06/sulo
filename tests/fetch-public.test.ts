import { describe, expect, it } from 'vitest';
import { createScheduler } from '../lib/net/scheduler';
import { FETCH_SLOT_KEY, fetchPublicJson, fetchSlotHour, isPublicFetchDue } from '../lib/remote/fetch-public';
import { fakeFetch, fixedClock, jsonResponse, memoryStore } from './helpers';

const NOW = 1_794_000_000;
const H = 3600;
const URL_ = 'https://ikrar06.github.io/sulo-data/kalender.json';
const KEY = 'global:remoteFile:test';

function deps(respond: () => Response, store = memoryStore(), now = NOW, hour = 10) {
  const fetch = fakeFetch(respond);
  const clock = fixedClock('2026-11-13', hour, now);
  return { fetch, store, d: { scheduler: createScheduler({ fetch, store, clock }), store, clock, url: URL_, stateKey: KEY, trigger: 'test' } };
}

describe('when a public file is due', () => {
  it('fetches at once when never fetched', () => {
    expect(isPublicFetchDue(null, NOW, 3)).toBe(true);
  });

  it('never twice within 24 hours', () => {
    expect(isPublicFetchDue(NOW - 23 * H, NOW, 12, 8)).toBe(false);
    expect(isPublicFetchDue(NOW - 23 * H, NOW, 12)).toBe(false);
  });

  it('after 24 hours, from the installation fetch hour onwards', () => {
    expect(isPublicFetchDue(NOW - 25 * H, NOW, 7, 8)).toBe(false);
    expect(isPublicFetchDue(NOW - 25 * H, NOW, 8, 8)).toBe(true);
  });

  it('after 48 hours at any hour (the browser may never be open at the fetch hour)', () => {
    expect(isPublicFetchDue(NOW - 49 * H, NOW, 7, 20)).toBe(true);
  });

  it('draws the fetch hour once per installation, between 06 and 21', async () => {
    const store = memoryStore();
    expect(await fetchSlotHour(store, () => 0)).toBe(6);
    expect(await fetchSlotHour(store, () => 0.99)).toBe(6);
    expect(store.dump()[FETCH_SLOT_KEY]).toBe(6);
    expect(await fetchSlotHour(memoryStore(), () => 0.9999)).toBe(21);
  });
});

describe('fetchPublicJson', () => {
  it('sends no cookie and no header of its own, and lets the browser revalidate', async () => {
    const { fetch, d } = deps(() => jsonResponse({ a: 1 }));
    expect(await fetchPublicJson(d)).toEqual({ kind: 'changed', json: { a: 1 } });
    expect(fetch.calls[0]?.url).toBe(URL_);
    expect(fetch.calls[0]?.init).toMatchObject({ method: 'GET', credentials: 'omit', cache: 'no-cache' });
    expect(fetch.calls[0]?.init?.headers).toBeUndefined();
  });

  it('reads a 304 from revalidation as "unchanged", not as an error', async () => {
    const { d, store } = deps(() => new Response(null, { status: 304 }));
    expect(await fetchPublicJson(d)).toEqual({ kind: 'unchanged' });
    expect(store.dump()[KEY]).toMatchObject({ fetchedAt: NOW });
    expect(store.dump()['global:backoff:sulo-data']).toBeUndefined();
  });

  it('reads the same body (same hash) as "unchanged"', async () => {
    const store = memoryStore();
    await fetchPublicJson(deps(() => jsonResponse({ a: 1 }), store).d);
    expect(await fetchPublicJson(deps(() => jsonResponse({ a: 1 }), store, NOW + 25 * H).d)).toEqual({ kind: 'unchanged' });
    expect(await fetchPublicJson(deps(() => jsonResponse({ a: 2 }), store, NOW + 50 * H).d)).toEqual({ kind: 'changed', json: { a: 2 } });
  });

  it('keeps Last-Modified for reference', async () => {
    const { d, store } = deps(() => jsonResponse({ a: 1 }, { headers: { 'content-type': 'application/json', 'last-modified': 'Fri, 13 Nov 2026 01:00:00 GMT' } }));
    await fetchPublicJson(d);
    expect(store.dump()[KEY]).toMatchObject({ lastModified: 'Fri, 13 Nov 2026 01:00:00 GMT' });
  });

  it('records the attempt on failure, so it is not retried before the next day', async () => {
    const store = memoryStore();
    expect(await fetchPublicJson(deps(() => new Response('', { status: 404 }), store).d)).toEqual({ kind: 'failed', reason: 'http 404' });
    const again = deps(() => jsonResponse({}), store, NOW + H);
    expect(await fetchPublicJson(again.d)).toEqual({ kind: 'not_due' });
    expect(again.fetch.calls).toHaveLength(0);
  });

  it('reports invalid JSON as a failure', async () => {
    expect(await fetchPublicJson(deps(() => new Response('{oops', { headers: { 'content-type': 'application/json' } })).d)).toEqual({
      kind: 'failed',
      reason: 'invalid json',
    });
  });
});
