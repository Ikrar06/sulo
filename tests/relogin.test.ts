import { describe, expect, it } from 'vitest';
import { announceRelogin, isSignedInSikolaPage, RELOGIN_WINDOW_SEC, reloginStep, type ReloginMarker } from '../lib/sync/relogin';
import type { SessionState } from '../lib/types';

const NOW = 1_800_000_000;
const PAGE = 'https://sikola-v2.unhas.ac.id/my/';
const step = (event: Parameters<typeof reloginStep>[0]['event'], session: SessionState, marker: ReloginMarker | null = null, now = NOW) => reloginStep({ event, session, marker, now });

describe('which tab loads count', () => {
  it('SIKOLA pages other than its login', () => {
    expect(isSignedInSikolaPage(PAGE)).toBe(true);
    expect(isSignedInSikolaPage('https://sikola-v2.unhas.ac.id/course/view.php?id=5')).toBe(true);
    expect(isSignedInSikolaPage('https://sikola-v2.unhas.ac.id/login/index.php')).toBe(false);
    expect(isSignedInSikolaPage('https://sikola-v2.unhas.ac.id/login/logout.php?sesskey=x')).toBe(false);
    expect(isSignedInSikolaPage('https://sikola-v2.unhas.ac.id/login')).toBe(false);
    expect(isSignedInSikolaPage('https://neosia.unhas.ac.id/')).toBe(false);
    expect(isSignedInSikolaPage('http://sikola-v2.unhas.ac.id/my/')).toBe(false);
    expect(isSignedInSikolaPage(undefined)).toBe(false);
    expect(isSignedInSikolaPage('not a url')).toBe(false);
  });
});

describe('sync after signing in again', () => {
  it('connected: opening SIKOLA never syncs (no extra request)', () => {
    expect(step({ kind: 'page', url: PAGE }, 'OK')).toEqual({ marker: null, sync: false });
    expect(step({ kind: 'sesskey', wasExpired: false }, 'OK')).toEqual({ marker: null, sync: false });
    expect(step({ kind: 'page', url: PAGE }, 'UNKNOWN')).toEqual({ marker: null, sync: false });
  });

  it('expired, page then sesskey: one sync on the sesskey', () => {
    const a = step({ kind: 'page', url: PAGE }, 'EXPIRED');
    expect(a).toEqual({ marker: { sesskeyAt: null, pageAt: NOW }, sync: false });
    expect(step({ kind: 'sesskey', wasExpired: true }, 'UNKNOWN', a.marker, NOW + 2)).toEqual({ marker: null, sync: true });
  });

  it('expired, sesskey then page: one sync on the page', () => {
    const a = step({ kind: 'sesskey', wasExpired: true }, 'UNKNOWN');
    expect(a).toEqual({ marker: { sesskeyAt: NOW, pageAt: null }, sync: false });
    const b = step({ kind: 'page', url: PAGE }, 'UNKNOWN', a.marker, NOW + 1);
    expect(b).toEqual({ marker: null, sync: true });
    // Further pages after that: nothing more.
    expect(step({ kind: 'page', url: PAGE }, 'OK', b.marker, NOW + 5)).toEqual({ marker: null, sync: false });
  });

  it('the login page is ignored, also while expired', () => {
    expect(step({ kind: 'page', url: 'https://sikola-v2.unhas.ac.id/login/index.php' }, 'EXPIRED')).toEqual({ marker: null, sync: false });
    const a = step({ kind: 'sesskey', wasExpired: true }, 'UNKNOWN');
    expect(step({ kind: 'page', url: 'https://sikola-v2.unhas.ac.id/login/index.php' }, 'UNKNOWN', a.marker).sync).toBe(false);
  });

  it('expired with no sesskey (still signed out): no sync', () => {
    const a = step({ kind: 'page', url: PAGE }, 'EXPIRED');
    expect(step({ kind: 'page', url: PAGE }, 'EXPIRED', a.marker, NOW + 60).sync).toBe(false);
  });

  it('halves more than 10 minutes apart do not pair', () => {
    const a = step({ kind: 'page', url: PAGE }, 'EXPIRED');
    expect(step({ kind: 'sesskey', wasExpired: true }, 'UNKNOWN', a.marker, NOW + RELOGIN_WINDOW_SEC + 1)).toEqual({ marker: { sesskeyAt: NOW + RELOGIN_WINDOW_SEC + 1, pageAt: null }, sync: false });
  });

  it('"Sulo sudah diperbarui" only after a sync that brought data, never in quiet hours', () => {
    expect(announceRelogin({ status: 'ok', inQuietHours: false })).toBe(true);
    expect(announceRelogin({ status: 'ok', inQuietHours: true })).toBe(false);
    for (const status of ['skipped', 'session_expired', 'offline', 'invalid_sesskey']) expect(announceRelogin({ status, inQuietHours: false })).toBe(false);
  });
});
