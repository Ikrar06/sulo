// Sync after signing in to SIKOLA again (M7.2). Sulo never keeps a session
// alive by itself (no periodic ping, no extra request). Instead it reacts:
// when the session had expired and the user signs in again, one ordinary
// sync runs (runSync: cooldown, lock, budget), so the data catches up
// without a click. Pure: the background feeds it two events.
//
// - page: a SIKOLA tab finished loading (chrome.tabs.onUpdated, status
//   "complete"). The host permission alone exposes the URL of SIKOLA tabs,
//   so no "tabs" permission. The login page is ignored.
// - sesskey: the content script found a sesskey on a signed-in page.
//
// Both must happen, in either order, within RELOGIN_WINDOW_SEC, and only
// while the session is expired (or was, just before that sesskey arrived).
// A connected session never reacts: opening SIKOLA sends nothing extra.

import type { SessionState, UnixSeconds } from '../types';

/** The two halves of a sign-in must arrive this close together. */
export const RELOGIN_WINDOW_SEC = 10 * 60;

export interface ReloginMarker {
  /** A fresh sesskey arrived while the session was expired. */
  sesskeyAt: UnixSeconds | null;
  /** A signed-in SIKOLA page finished loading while the session was expired. */
  pageAt: UnixSeconds | null;
}

export type ReloginEvent = { kind: 'page'; url: string | undefined } | { kind: 'sesskey'; wasExpired: boolean };

const SIKOLA_HOST = 'sikola-v2.unhas.ac.id';

/** A SIKOLA page other than its login (and logout) pages. */
export function isSignedInSikolaPage(url: string | undefined): boolean {
  if (!url) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' || u.hostname !== SIKOLA_HOST) return false;
  return !/^\/login(\/|$)/.test(u.pathname);
}

const recent = (at: UnixSeconds | null, now: UnixSeconds) => at !== null && now - at <= RELOGIN_WINDOW_SEC;

export function reloginStep(input: { event: ReloginEvent; session: SessionState; marker: ReloginMarker | null; now: UnixSeconds }): { marker: ReloginMarker | null; sync: boolean } {
  const { event, now } = input;
  const marker = input.marker && (recent(input.marker.sesskeyAt, now) || recent(input.marker.pageAt, now)) ? input.marker : null;
  if (event.kind === 'page') {
    if (!isSignedInSikolaPage(event.url)) return { marker, sync: false };
    // The sesskey came first (it moved the session out of EXPIRED): sync now.
    if (marker && recent(marker.sesskeyAt, now)) return { marker: null, sync: true };
    // Still expired: remember the page and wait for the sesskey.
    if (input.session === 'EXPIRED') return { marker: { sesskeyAt: null, pageAt: now }, sync: false };
    return { marker, sync: false };
  }
  if (!event.wasExpired) return { marker, sync: false };
  if (marker && recent(marker.pageAt, now)) return { marker: null, sync: true };
  return { marker: { sesskeyAt: now, pageAt: null }, sync: false };
}

/**
 * "Sulo sudah diperbarui": a quiet notification, only for a sync that
 * actually brought data, and never in quiet hours.
 */
export function announceRelogin(input: { status: string; inQuietHours: boolean }): boolean {
  return input.status === 'ok' && !input.inQuietHours;
}
