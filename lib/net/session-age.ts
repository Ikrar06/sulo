// SIKOLA session age log (M7 part F): how long a session lasts, measured
// only from what Sulo already does. Never a ping or an extra request, and
// sync behaves exactly as before: the Moodle client reports outcomes here
// after the fact. Development and tester builds only (the background passes
// nothing in production). Local, never sent, not in the bug report copy;
// "Hapus semua data" clears it with everything else. Pure; the store is injected.

import type { KeyValueStore, UnixSeconds } from '../types';

export const SESSION_AGE_KEY = 'global:sessionAge';
export const SESSION_AGE_MAX = 30;

export interface SessionAgeEntry {
  expiredDetectedAt: UnixSeconds;
  /** Minutes from the last successful SIKOLA request to the detection. */
  sejakSuksesTerakhirMenit: number;
  /** Minutes from the session's first success to the detection; null when its start was not seen. */
  sejakMulaiSesiMenit: number | null;
}

export interface SessionAgeState {
  /** Last successful SIKOLA request. */
  lastSuccessAt: UnixSeconds | null;
  /** First success after a new session was detected; null until then. */
  sessionStartAt: UnixSeconds | null;
  /** A new session was detected (sesskey or account changed, or after an expiry): the next success starts it. */
  newSession: boolean;
  /** This expiry is already logged; reset by the next success. */
  expiryLogged: boolean;
  /** Newest first, at most SESSION_AGE_MAX. */
  entries: SessionAgeEntry[];
}

export const EMPTY_SESSION_AGE: SessionAgeState = { lastSuccessAt: null, sessionStartAt: null, newSession: true, expiryLogged: false, entries: [] };

const minutes = (from: UnixSeconds, to: UnixSeconds) => Math.max(0, Math.round((to - from) / 60));

/** A successful SIKOLA request. */
export function onSuccess(s: SessionAgeState, now: UnixSeconds): SessionAgeState {
  const start = s.newSession || s.sessionStartAt === null ? now : s.sessionStartAt;
  return { ...s, lastSuccessAt: now, sessionStartAt: start, newSession: false, expiryLogged: false };
}

/** The sesskey or the account changed: the next success starts a new session. */
export function onNewSession(s: SessionAgeState): SessionAgeState {
  return s.newSession ? s : { ...s, newSession: true, sessionStartAt: null };
}

/** A sync found the session gone: one entry per expiry, then a new session is expected. */
export function onExpired(s: SessionAgeState, now: UnixSeconds): SessionAgeState {
  if (s.expiryLogged || s.lastSuccessAt === null) return { ...s, newSession: true, sessionStartAt: null, expiryLogged: true };
  const entry: SessionAgeEntry = {
    expiredDetectedAt: now,
    sejakSuksesTerakhirMenit: minutes(s.lastSuccessAt, now),
    sejakMulaiSesiMenit: s.sessionStartAt === null ? null : minutes(s.sessionStartAt, now),
  };
  return { ...s, entries: [entry, ...s.entries].slice(0, SESSION_AGE_MAX), newSession: true, sessionStartAt: null, expiryLogged: true };
}

/** Median and minimum of "since the last success", in minutes; null without entries. */
export function sessionAgeStats(entries: readonly SessionAgeEntry[]): { count: number; median: number | null; min: number | null } {
  const values = entries.map((e) => e.sejakSuksesTerakhirMenit).sort((a, b) => a - b);
  if (values.length === 0) return { count: 0, median: null, min: null };
  const mid = Math.floor(values.length / 2);
  const median = values.length % 2 === 1 ? values[mid]! : (values[mid - 1]! + values[mid]!) / 2;
  return { count: values.length, median, min: values[0]! };
}

/**
 * Median session lifetime in hours (from the session's first success to the
 * expiry being seen), one decimal; null without such entries. The #dev-sesi
 * suggestion line.
 */
export function medianSessionHours(entries: readonly SessionAgeEntry[]): number | null {
  const values = entries.map((e) => e.sejakMulaiSesiMenit).filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);
  if (values.length === 0) return null;
  const mid = Math.floor(values.length / 2);
  const minutes = values.length % 2 === 1 ? values[mid]! : (values[mid - 1]! + values[mid]!) / 2;
  return Math.round((minutes / 60) * 10) / 10;
}

export async function readSessionAge(store: KeyValueStore): Promise<SessionAgeState> {
  const raw = await store.get<SessionAgeState>(SESSION_AGE_KEY);
  return raw && Array.isArray(raw.entries) ? { ...EMPTY_SESSION_AGE, ...raw } : EMPTY_SESSION_AGE;
}

export interface SessionAgeLogger {
  success(now: UnixSeconds): Promise<void>;
  expired(now: UnixSeconds): Promise<void>;
  newSession(): Promise<void>;
}

/** Serialized read-modify-write on the store (outcomes can arrive close together). */
export function createSessionAgeLogger(store: KeyValueStore): SessionAgeLogger {
  let queue: Promise<unknown> = Promise.resolve();
  const update = (change: (s: SessionAgeState) => SessionAgeState) => {
    const run = queue.then(async () => store.set(SESSION_AGE_KEY, change(await readSessionAge(store))));
    queue = run.catch(() => undefined);
    return run.catch(() => undefined);
  };
  return {
    success: (now) => update((s) => onSuccess(s, now)),
    expired: (now) => update((s) => onExpired(s, now)),
    newSession: () => update(onNewSession),
  };
}
