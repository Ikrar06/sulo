// How long a Sipakamase session lasts, measured from what Sulo already does
// (owner's decision of 26 Nov 2026, docs/ios/PENJAGA-SESI.md A2): no request
// of its own. Every read that came back signed in, every read that landed on
// the login page, and the gaps between them. Times only, never a cookie.
//
// The keeper's pace follows it: half the shortest lifetime seen since the
// last activity, or half the longest gap a session survived, within the
// remote config's floor (Sulo's hard rule 17: every 3 hours or slower) and
// 12 hours. Without any of that, the config's own pace. Pure, with a store
// wrapper.

import type { KeyValueStore, UnixSeconds } from '../types';
import { SIPAKAMASE_DATA_PREFIX } from './store';

export const SIPAKAMASE_SESSION_LOG_KEY = `${SIPAKAMASE_DATA_PREFIX}sessionLog`;
const MAX_ENTRIES = 30;
/** Hard rule 17's slowest keeper pace (remote/sources.ts keepIntervalMinutes upper bound). */
export const KEEP_MAX_MIN = 720;

export interface SipakamaseSessionEnd {
  /** When a read landed on the login page. */
  endedAt: UnixSeconds;
  /** Minutes from the last signed-in read to that. */
  sinceLastOkMin: number;
  /** Minutes from the session's first signed-in read; null when its start was not seen. */
  sinceStartMin: number | null;
}

export interface SipakamaseSessionLog {
  lastOkAt: UnixSeconds | null;
  sessionStartAt: UnixSeconds | null;
  /** The longest gap between two signed-in reads of one session, in minutes: it lasts at least that long. */
  longestOkGapMin: number;
  /** Newest last, at most MAX_ENTRIES. */
  ends: SipakamaseSessionEnd[];
  /** The session cookie's attributes in the latest answer that set it (phone only): never its value. */
  cookie?: { expires: boolean; maxAge: number | null; seenAt: UnixSeconds };
}

export const EMPTY_SESSION_LOG: SipakamaseSessionLog = { lastOkAt: null, sessionStartAt: null, longestOkGapMin: 0, ends: [] };

const minutes = (from: UnixSeconds, to: UnixSeconds) => Math.max(0, Math.round((to - from) / 60));

/** A read came back signed in (the app's, the worker's, or the passive reader's). Older news is ignored. */
export function onSignedIn(log: SipakamaseSessionLog, at: UnixSeconds): SipakamaseSessionLog {
  if (log.lastOkAt !== null && at <= log.lastOkAt) return log;
  const gap = log.lastOkAt === null ? 0 : minutes(log.lastOkAt, at);
  return {
    ...log,
    lastOkAt: at,
    sessionStartAt: log.sessionStartAt ?? at,
    longestOkGapMin: Math.max(log.longestOkGapMin, gap),
  };
}

/** A read landed on the login page: one entry per ended session, then a new one is expected. */
export function onLoginPage(log: SipakamaseSessionLog, at: UnixSeconds): SipakamaseSessionLog {
  if (log.lastOkAt === null || at <= log.lastOkAt) return { ...log, lastOkAt: null, sessionStartAt: null };
  const end: SipakamaseSessionEnd = {
    endedAt: at,
    sinceLastOkMin: minutes(log.lastOkAt, at),
    sinceStartMin: log.sessionStartAt === null ? null : minutes(log.sessionStartAt, at),
  };
  return { ...log, lastOkAt: null, sessionStartAt: null, ends: [...log.ends, end].slice(-MAX_ENTRIES) };
}

export interface KeepPace {
  /** The keeper's interval to use, in minutes. */
  intervalMin: number;
  /** What it rests on. */
  basis: 'config' | 'ended' | 'survived';
  /** Half the measured lifetime is shorter than the floor the rules allow: the keeper cannot keep up. */
  tooSlow: boolean;
}

/** The keeper's pace from the log, never faster than `floorMin` (the config) nor slower than 12 hours. */
export function keepPace(log: SipakamaseSessionLog, floorMin: number): KeepPace {
  const clamp = (v: number) => Math.min(KEEP_MAX_MIN, Math.max(floorMin, Math.floor(v)));
  if (log.ends.length > 0) {
    const shortest = Math.min(...log.ends.map((e) => e.sinceLastOkMin));
    return { intervalMin: clamp(shortest / 2), basis: 'ended', tooSlow: shortest / 2 < floorMin };
  }
  if (log.longestOkGapMin > 0) return { intervalMin: clamp(log.longestOkGapMin / 2), basis: 'survived', tooSlow: false };
  return { intervalMin: floorMin, basis: 'config', tooSlow: false };
}

export async function readSessionLog(store: KeyValueStore): Promise<SipakamaseSessionLog> {
  const raw = await store.get<SipakamaseSessionLog>(SIPAKAMASE_SESSION_LOG_KEY);
  return raw && Array.isArray(raw.ends) ? { ...EMPTY_SESSION_LOG, ...raw } : EMPTY_SESSION_LOG;
}

/** What the latest answer's Set-Cookie said about the session cookie's lifetime (attributes only). */
export async function noteCookieAttrs(store: KeyValueStore, attrs: { expires: boolean; maxAge: number | null }, at: UnixSeconds): Promise<void> {
  const log = await readSessionLog(store);
  await store.set(SIPAKAMASE_SESSION_LOG_KEY, { ...log, cookie: { expires: attrs.expires, maxAge: attrs.maxAge, seenAt: at } });
}

export async function noteSession(store: KeyValueStore, event: 'signed_in' | 'login_page', at: UnixSeconds): Promise<void> {
  const log = await readSessionLog(store);
  await store.set(SIPAKAMASE_SESSION_LOG_KEY, event === 'signed_in' ? onSignedIn(log, at) : onLoginPage(log, at));
}
