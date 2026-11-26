import { describe, expect, it } from 'vitest';
import { EMPTY_SESSION_LOG, keepPace, noteCookieAttrs, noteSession, onLoginPage, onSignedIn, readSessionLog } from '@sulo/core/sipakamase/session-log';
import { memoryStore } from './helpers';

const H = 3600;

describe('Sipakamase session log', () => {
  it('measures each ended session from the last signed-in read and from its start', () => {
    let log = onSignedIn(EMPTY_SESSION_LOG, 0);
    log = onSignedIn(log, 3 * H);
    log = onLoginPage(log, 8 * H);
    expect(log.ends).toEqual([{ endedAt: 8 * H, sinceLastOkMin: 300, sinceStartMin: 480 }]);
    expect(log.lastOkAt).toBeNull();
    // A second login page without a signed-in read in between is not a new session.
    expect(onLoginPage(log, 9 * H).ends).toHaveLength(1);
  });

  it('remembers the longest gap a session survived, and ignores older news', () => {
    let log = onSignedIn(EMPTY_SESSION_LOG, 0);
    log = onSignedIn(log, 10 * H);
    log = onSignedIn(log, 11 * H);
    expect(log.longestOkGapMin).toBe(600);
    expect(onSignedIn(log, 5 * H)).toBe(log);
  });

  it('paces the keeper at half the measured lifetime, never faster than the config nor slower than 12 hours', () => {
    expect(keepPace(EMPTY_SESSION_LOG, 180)).toEqual({ intervalMin: 180, basis: 'config', tooSlow: false });
    // Survived 10 hours: every 5 hours is safe.
    const survived = onSignedIn(onSignedIn(EMPTY_SESSION_LOG, 0), 10 * H);
    expect(keepPace(survived, 180)).toEqual({ intervalMin: 300, basis: 'survived', tooSlow: false });
    // Survived 2 days: still at most 12 hours (hard rule 17's slowest).
    expect(keepPace(onSignedIn(onSignedIn(EMPTY_SESSION_LOG, 0), 48 * H), 180).intervalMin).toBe(720);
    // Ended after 4 hours untouched: half is 2 hours, faster than the rules allow, so the floor holds and it says so.
    const ended = onLoginPage(onSignedIn(EMPTY_SESSION_LOG, 0), 4 * H);
    expect(keepPace(ended, 180)).toEqual({ intervalMin: 180, basis: 'ended', tooSlow: true });
    // Ended after 10 hours: every 5 hours.
    expect(keepPace(onLoginPage(onSignedIn(EMPTY_SESSION_LOG, 0), 10 * H), 180)).toEqual({ intervalMin: 300, basis: 'ended', tooSlow: false });
    // The config's own floor wins over a shorter half.
    expect(keepPace(survived, 360).intervalMin).toBe(360);
  });

  it('keeps cookie attributes and events in the store, never a cookie value', async () => {
    const store = memoryStore();
    await noteSession(store, 'signed_in', 100);
    await noteCookieAttrs(store, { expires: false, maxAge: null }, 100);
    await noteSession(store, 'login_page', 100 + 6 * H);
    const log = await readSessionLog(store);
    expect(log.ends).toHaveLength(1);
    expect(log.cookie).toEqual({ expires: false, maxAge: null, seenAt: 100 });
    expect(JSON.stringify(log)).not.toMatch(/session=/);
  });
});
