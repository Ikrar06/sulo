import { describe, expect, it } from 'vitest';
import { createMoodleClient } from '../lib/moodle/client';
import { calls } from '../lib/moodle/calls';
import { createSessionAgeLogger, EMPTY_SESSION_AGE, onExpired, onNewSession, onSuccess, readSessionAge, SESSION_AGE_MAX, medianSessionHours, sessionAgeStats } from '../lib/net/session-age';
import { fixedClock, jsonResponse, memoryStore } from './helpers';

const T = 1_794_000_000;
const MIN = 60;

describe('session age log', () => {
  it('starts a session at the first success and logs one entry when it expires', () => {
    let s = onSuccess(EMPTY_SESSION_AGE, T);
    s = onSuccess(s, T + 30 * MIN);
    s = onExpired(s, T + 100 * MIN);
    expect(s.entries).toEqual([{ expiredDetectedAt: T + 100 * MIN, sejakSuksesTerakhirMenit: 70, sejakMulaiSesiMenit: 100 }]);
    // The same expiry seen again by the next sync: still one entry.
    s = onExpired(s, T + 200 * MIN);
    expect(s.entries).toHaveLength(1);
  });

  it('a new sesskey or account starts a new session at the next success', () => {
    let s = onSuccess(EMPTY_SESSION_AGE, T);
    s = onNewSession(s);
    s = onSuccess(s, T + 50 * MIN);
    expect(s.sessionStartAt).toBe(T + 50 * MIN);
    s = onExpired(s, T + 60 * MIN);
    expect(s.entries[0]).toMatchObject({ sejakSuksesTerakhirMenit: 10, sejakMulaiSesiMenit: 10 });
  });

  it('after an expiry the next success starts a new session', () => {
    let s = onExpired(onSuccess(EMPTY_SESSION_AGE, T), T + 10 * MIN);
    s = onSuccess(s, T + 500 * MIN);
    expect(s.sessionStartAt).toBe(T + 500 * MIN);
    expect(s.expiryLogged).toBe(false);
  });

  it('keeps at most 30 entries, newest first', () => {
    let s = EMPTY_SESSION_AGE;
    for (let i = 0; i < SESSION_AGE_MAX + 5; i++) s = onExpired(onSuccess(s, T + i * 1000), T + i * 1000 + 600);
    expect(s.entries).toHaveLength(SESSION_AGE_MAX);
    expect(s.entries[0]!.expiredDetectedAt).toBeGreaterThan(s.entries[1]!.expiredDetectedAt);
  });

  it('computes median and minimum of "since the last success"', () => {
    const e = (m: number) => ({ expiredDetectedAt: m, sejakSuksesTerakhirMenit: m, sejakMulaiSesiMenit: null });
    expect(sessionAgeStats([])).toEqual({ count: 0, median: null, min: null });
    expect(sessionAgeStats([e(30), e(10), e(50)])).toEqual({ count: 3, median: 30, min: 10 });
    expect(sessionAgeStats([e(30), e(10), e(50), e(70)])).toEqual({ count: 4, median: 40, min: 10 });
  });

  it('#dev-sesi suggestion: median session lifetime in hours, entries without a session start skipped', () => {
    const e = (start: number | null) => ({ expiredDetectedAt: 1, sejakSuksesTerakhirMenit: 5, sejakMulaiSesiMenit: start });
    expect(medianSessionHours([])).toBeNull();
    expect(medianSessionHours([e(null)])).toBeNull();
    expect(medianSessionHours([e(120), e(null), e(480), e(300)])).toBe(5);
    expect(medianSessionHours([e(100), e(200)])).toBe(2.5);
  });

  it('is told by the Moodle client after the fact and adds no request', async () => {
    const store = memoryStore({ 'global:session': { state: 'OK', userId: 1, checkedAt: 1 } });
    const sent: string[] = [];
    const responses = [jsonResponse([{ error: false, data: { userid: 1, timeremaining: 100 } }]), new Response('', { status: 303, headers: { location: '/login/index.php' } })];
    const fetch = async (url: string) => {
      sent.push(url);
      return responses.shift()!;
    };
    const clock = fixedClock();
    const client = createMoodleClient({ fetch, store, clock, baseUrl: 'https://sikola-v2.unhas.ac.id', getSesskey: async () => 'SESSKEY01', sessionAge: createSessionAgeLogger(store) });
    await client.callBatch([calls.sessionTimeRemaining()]);
    await client.callBatch([calls.sessionTimeRemaining()]);
    expect(sent).toHaveLength(2);
    const state = await readSessionAge(store);
    expect(state.lastSuccessAt).toBe(clock.now());
    expect(state.entries).toHaveLength(1);
  });
});
