import { describe, expect, it } from 'vitest';
import { BUDGET_KEY } from '../lib/moodle/budget';
import { createMoodleClient } from '../lib/moodle/client';
import { FALLBACK_KEY, extractSesskeyFromHtml, trySesskeyFallbackFromPopup } from '../lib/moodle/sesskey-fallback';
import { fakeFetch, fixedClock, memoryStore } from './helpers';

const BASE = 'https://sikola-v2.unhas.ac.id';
const NOW = 1_794_000_000;
const page = (body: string) => () => new Response(body, { headers: { 'content-type': 'text/html' } });
const MY_PAGE = '<script>M.cfg = {"wwwroot":"x","sesskey":"SESSKEY001","themerev":"1"};</script>';

function setup(respond: () => Response, initial: Record<string, unknown> = {}, now = NOW) {
  const store = memoryStore(initial);
  const clock = fixedClock('2026-11-13', 10, now);
  const fetch = fakeFetch(respond);
  const client = createMoodleClient({ fetch, store, clock, baseUrl: BASE, getSesskey: async () => null });
  return { store, clock, fetch, client };
}

describe('extractSesskeyFromHtml', () => {
  it('reads the sesskey from M.cfg', () => {
    expect(extractSesskeyFromHtml(MY_PAGE)).toBe('SESSKEY001');
  });
  it('returns null for a login page or malformed value', () => {
    expect(extractSesskeyFromHtml('<form id="login"></form>')).toBeNull();
    expect(extractSesskeyFromHtml('"sesskey":"<x>"')).toBeNull();
  });
});

describe('popup sesskey fallback', () => {
  it('recovers the sesskey and spends one request from the budget', async () => {
    const { client, store, clock, fetch } = setup(page(MY_PAGE));
    expect(await trySesskeyFallbackFromPopup({ client, store, clock })).toEqual({ kind: 'recovered', sesskey: 'SESSKEY001' });
    expect(fetch.calls[0]?.url).toBe(`${BASE}/my/`);
    expect((store.dump()[BUDGET_KEY] as { used: number }).used).toBe(1);
  });

  it('runs at most once per 6 hours, even after a failure', async () => {
    const { client, store, clock, fetch } = setup(() => {
      throw new TypeError('offline');
    });
    expect((await trySesskeyFallbackFromPopup({ client, store, clock })).kind).toBe('failed');
    expect(await trySesskeyFallbackFromPopup({ client, store, clock })).toEqual({ kind: 'too_soon' });
    expect(fetch.calls).toHaveLength(1);
  });

  it('runs again once 6 hours have passed', async () => {
    const { client, store, clock, fetch } = setup(page(MY_PAGE), { [FALLBACK_KEY]: { lastPopupAttemptAt: NOW - 6 * 3600 } });
    expect((await trySesskeyFallbackFromPopup({ client, store, clock })).kind).toBe('recovered');
    expect(fetch.calls).toHaveLength(1);
  });

  it('reports login_required on a redirect to the login page', async () => {
    const redirect = () => Object.defineProperty(new Response(null), 'type', { value: 'opaqueredirect' }) as Response;
    const { client, store, clock } = setup(redirect);
    expect(await trySesskeyFallbackFromPopup({ client, store, clock })).toEqual({ kind: 'login_required' });
  });

  it('reports not_found when the page has no sesskey', async () => {
    const { client, store, clock } = setup(page('<form id="login"></form>'));
    expect(await trySesskeyFallbackFromPopup({ client, store, clock })).toEqual({ kind: 'not_found' });
  });
});
