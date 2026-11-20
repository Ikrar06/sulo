import { describe, expect, it } from 'vitest';
import { calls } from '@sulo/core/moodle/calls';
import { createMoodleClient, FRESH_CONNECTION_HEADER, interpretBatch, type MoodleClientDeps } from '@sulo/core/moodle/client';
import { SESSION_KEY } from '@sulo/core/moodle/session';
import { TECH_LOG_KEY } from '@sulo/core/net/tech-log';
import { fakeFetch, fixedClock, jsonResponse, memoryStore } from './helpers';

const BASE = 'https://sikola-v2.unhas.ac.id';
const NOW = 1_794_000_000;
const batch = [calls.sessionTimeRemaining(), calls.calendarActionEvents(1_790_000_000), calls.courseformatState(401)];
const ok = (data: unknown) => ({ error: false, data });
const err = (errorcode: string) => ({ error: true, exception: { errorcode, message: 'x' } });
const loginAnswer = () => jsonResponse([err('servicerequireslogin')]);
const sessionOk = () => jsonResponse([ok({ userid: 7, timeremaining: 28000 })]);

function setup(answers: (() => Response)[], overrides: Partial<MoodleClientDeps> = {}) {
  const store = memoryStore({});
  let i = 0;
  const fetch = fakeFetch(() => answers[Math.min(i++, answers.length - 1)]!());
  const ended: string[] = [];
  let waits = 0;
  const deps: MoodleClientDeps = {
    fetch,
    store,
    clock: fixedClock('2026-11-20', 10, NOW),
    baseUrl: BASE,
    getSesskey: async () => 'SESSKEY001',
    confirmLogin: { wait: async () => void waits++ },
    onSessionEnded: async (why) => void ended.push(why),
    ...overrides,
  };
  return { client: createMoodleClient(deps), store, fetch, ended, waits: () => waits };
}

const state = (store: ReturnType<typeof memoryStore>) => (store.dump()[SESSION_KEY] as { state: string } | undefined)?.state;

describe('Moodle stops a batch at its first error (20 Nov 2026, the phone)', () => {
  it('a session call that failed is read even when it is the only answer', async () => {
    expect(await interpretBatch(jsonResponse([err('servicerequireslogin')]), batch)).toEqual({ kind: 'login_required', why: 'session:servicerequireslogin' });
    expect((await interpretBatch(jsonResponse([err('invalidsesskey')]), batch)).kind).toBe('invalid_sesskey');
  });

  it('a short answer whose session call worked is still not a sign-out', async () => {
    const outcome = await interpretBatch(jsonResponse([ok({ userid: 1, timeremaining: 7000 }), err('requireloginerror')]), batch);
    expect(outcome.kind).not.toBe('login_required');
  });
});

describe('confirmLogin: one login answer is never enough', () => {
  it('ends the session only when a second ask, after the wait, says the same', async () => {
    const { client, store, fetch, ended, waits } = setup([loginAnswer, loginAnswer]);
    expect(await client.callBatch(batch)).toEqual({ kind: 'login_required', why: 'session:servicerequireslogin+session:servicerequireslogin' });
    expect(waits()).toBe(1);
    expect(fetch.calls).toHaveLength(2);
    // The second ask is core_session_time_remaining alone.
    expect(JSON.parse(String(fetch.calls[1]!.init?.body)).map((c: { methodname: string }) => c.methodname)).toEqual(['core_session_time_remaining']);
    // Over a new connection; the first ask is not.
    expect(new Headers(fetch.calls[1]!.init?.headers).get(FRESH_CONNECTION_HEADER)).toBe('1');
    expect(new Headers(fetch.calls[0]!.init?.headers).get(FRESH_CONNECTION_HEADER)).toBeNull();
    expect(state(store)).toBe('EXPIRED');
    expect(ended).toEqual(['session:servicerequireslogin+session:servicerequireslogin']);
  });

  it('a second ask that answers fine leaves the session as it was: a passing failure', async () => {
    const { client, store, ended } = setup([loginAnswer, sessionOk]);
    expect(await client.callBatch(batch)).toEqual({ kind: 'session_unconfirmed', why: 'session:servicerequireslogin>ok' });
    expect(state(store)).not.toBe('EXPIRED');
    expect(ended).toEqual([]);
    const log = store.dump()[TECH_LOG_KEY] as { fn: string; status: string }[];
    expect(log.map((e) => `${e.fn} ${e.status}`)).toContain('confirm:core_session_time_remaining ok');
  });

  it('a second ask that fails on the network is not a confirmation either', async () => {
    const { client, store } = setup([loginAnswer, () => { throw new TypeError('network'); }]);
    expect((await client.callBatch(batch)).kind).toBe('session_unconfirmed');
    expect(state(store)).not.toBe('EXPIRED');
  });

  it('a page redirect is asked again the same way', async () => {
    const redirect = () => new Response(null, { status: 303, headers: { location: `${BASE}/login/index.php` } });
    const { client, store, ended } = setup([redirect, sessionOk]);
    expect(await client.fetchPage('/mod/attendance/view.php?id=5&mode=1')).toEqual({ kind: 'session_unconfirmed', why: 'page_redirect>ok' });
    expect(state(store)).not.toBe('EXPIRED');
    expect(ended).toEqual([]);
  });

  it('without confirmLogin (the extension) the first answer ends it, as before', async () => {
    const { client, store, fetch } = setup([loginAnswer], { confirmLogin: undefined });
    expect((await client.callBatch(batch)).kind).toBe('login_required');
    expect(fetch.calls).toHaveLength(1);
    expect(state(store)).toBe('EXPIRED');
  });
});
