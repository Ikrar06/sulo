// The Sipakamase connection's states (docs/mkpk/RENCANA-RINCI.md D). Only the
// events below change the state; the transition is a pure function, and the
// store keeps the result with the time and cause (never any content), for
// the dev request log.
//
//   off ── connect ──▶ needs_login ── signed in ──▶ live ⇄ resting
//                         ▲                          │
//                         └──── login page ──────────┘
//   live, resting, broken, needs_login ── 7 days not opened ──▶ paused_idle
//   any but off ── remote off ──▶ paused_remote ── remote on ──▶ (back)
//   any ── disconnect ──▶ off

import type { KeyValueStore, UnixSeconds } from '../types';
import { SIPAKAMASE_DATA_PREFIX } from './store';

export type ConnState = 'off' | 'needs_login' | 'live' | 'resting' | 'paused_idle' | 'paused_remote' | 'broken';

export type ConnEvent =
  | { kind: 'connect' }
  /** A read that worked; `pending`: something is still waited for (store.ts hasPending). */
  | { kind: 'read_ok'; pending: boolean }
  /** Sipakamase answered with its login page or a redirect: believed at once (one answer). */
  | { kind: 'login_page' }
  /** A fragment whose headings changed. */
  | { kind: 'read_shape' }
  | { kind: 'idle_days' }
  | { kind: 'remote_off' }
  | { kind: 'remote_on' }
  | { kind: 'disconnect' };

export interface Connection {
  state: ConnState;
  since: UnixSeconds;
  cause: ConnEvent['kind'] | null;
  /** The state to go back to when the owner turns the source on again. */
  beforeRemote?: Exclude<ConnState, 'paused_remote' | 'off'>;
}

export const CONNECTION_KEY = `${SIPAKAMASE_DATA_PREFIX}connection`;
export const OFF: Connection = { state: 'off', since: 0, cause: null };

const working = (pending: boolean): ConnState => (pending ? 'live' : 'resting');

function next(c: Connection, e: ConnEvent): ConnState | null {
  if (e.kind === 'disconnect') return c.state === 'off' ? null : 'off';
  if (c.state === 'off') return e.kind === 'connect' ? 'needs_login' : null;
  if (e.kind === 'remote_off') return c.state === 'paused_remote' ? null : 'paused_remote';
  if (c.state === 'paused_remote') return e.kind === 'remote_on' ? (c.beforeRemote ?? 'needs_login') : null;
  if (c.state === 'paused_idle') return e.kind === 'connect' ? 'needs_login' : null;
  switch (e.kind) {
    case 'connect':
      return null;
    case 'idle_days':
      return 'paused_idle';
    case 'login_page':
      return c.state === 'needs_login' ? null : 'needs_login';
    case 'read_ok':
      return working(e.pending);
    case 'read_shape':
      // A changed page is not a lost session: the keeper goes on (broken keeps it), only reading failed.
      return 'broken';
    default:
      return null;
  }
}

/** The connection after `event`; the same object when nothing changes. */
export function transition(c: Connection, event: ConnEvent, now: UnixSeconds): Connection {
  const state = next(c, event);
  if (state === null || state === c.state) return c;
  const base: Connection = { state, since: now, cause: event.kind };
  if (state === 'paused_remote' && c.state !== 'off' && c.state !== 'paused_remote') return { ...base, beforeRemote: c.state };
  return base;
}

/** The keeper may send its rotating read only in these. */
export const keeperRuns = (state: ConnState): boolean => state === 'live' || state === 'broken';
/** "Perbarui sekarang" and the passive reader work in these. */
export const readsAllowed = (state: ConnState): boolean => state !== 'off' && state !== 'paused_remote' && state !== 'paused_idle';

export async function readConnection(store: KeyValueStore, enabled: boolean): Promise<Connection> {
  const raw = await store.get<Connection>(CONNECTION_KEY);
  const valid = raw && typeof raw.state === 'string' && typeof raw.since === 'number';
  if (!enabled) return OFF;
  // On without a stored state (just turned on, or an older install): waiting for a sign-in.
  return valid ? raw : { state: 'needs_login', since: 0, cause: 'connect' };
}

export const writeConnection = (store: KeyValueStore, c: Connection) => store.set(CONNECTION_KEY, c);
