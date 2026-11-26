// The three ways Sipakamase data comes in, one place for both platforms:
//
// - keep():    the keeper's rotating read (an alarm in the extension, the
//              SIKOLA check on the phone);
// - refresh(): "Perbarui sekarang", all five fragments in order;
// - passive(): what the passive reader saw on a page the student opened.
//
// Each one stores the fragment, moves the connection (connection.ts) and
// never retries: a login page or an error stops the run there.

import type { Scheduler } from '../net/scheduler';
import { sourcesFrom } from '../remote/sources';
import type { KeyValueStore, RemoteConfig, UnixSeconds } from '../types';
import { readFragment, type FragmentRead } from './client';
import { readConnection, readsAllowed, transition, writeConnection, type Connection, type ConnEvent } from './connection';
import { afterAuto, afterRefresh, planKeeper, planRefresh, readKeeper, writeKeeper } from './keeper';
import { readSipakamaseModule } from './module';
import { applyFragment, hasPending, queueNews, readSipakamaseData, statusChanges, writeSipakamaseData, type FragmentValue } from './store';
import type { PassiveRead } from './schema';

export interface SipakamaseDeps {
  store: KeyValueStore;
  scheduler: Scheduler;
  now: () => UnixSeconds;
  /** The local date, YYYY-MM-DD (the keeper's daily count). */
  today: () => string;
  config: () => Promise<RemoteConfig | null>;
  /** A connection change, for the dev log (time and cause only). */
  onTransition?: (from: Connection, to: Connection) => void;
}

async function move(deps: SipakamaseDeps, conn: Connection, event: ConnEvent): Promise<Connection> {
  const next = transition(conn, event, deps.now());
  if (next !== conn) {
    await writeConnection(deps.store, next);
    deps.onTransition?.(conn, next);
  }
  return next;
}

/** Stores a good value and moves the connection; a login or shape answer only moves it. */
async function settle(deps: SipakamaseDeps, conn: Connection, read: FragmentRead | { kind: 'value'; value: FragmentValue }): Promise<Connection> {
  if (read.kind === 'ok' || read.kind === 'value') {
    const before = await readSipakamaseData(deps.store);
    const data = applyFragment(before, read.value, deps.now());
    await writeSipakamaseData(deps.store, data);
    await queueNews(deps.store, statusChanges(before, data, deps.now()));
    return move(deps, conn, { kind: 'read_ok', pending: hasPending(data) });
  }
  if (read.kind === 'login') return move(deps, conn, { kind: 'login_page' });
  if (read.kind === 'shape') return move(deps, conn, { kind: 'read_shape' });
  return conn;
}

/** The connection now, after bringing the remote switch into it. */
async function current(deps: SipakamaseDeps): Promise<{ conn: Connection; enabled: boolean; config: ReturnType<typeof sourcesFrom>['sipakamase'] } | null> {
  const module = await readSipakamaseModule(deps.store);
  if (!module.enabled) return null;
  const config = sourcesFrom(await deps.config()).sipakamase;
  let conn = await readConnection(deps.store, true);
  if (!config.enabled) conn = await move(deps, conn, { kind: 'remote_off' });
  else if (conn.state === 'paused_remote') conn = await move(deps, conn, { kind: 'remote_on' });
  return { conn, enabled: config.enabled, config };
}

export type KeepResult = { sent: false; reason: string } | { sent: true; read: FragmentRead['kind'] };

export async function keep(deps: SipakamaseDeps): Promise<KeepResult> {
  const c = await current(deps);
  if (!c) return { sent: false, reason: 'off' };
  const keeper = await readKeeper(deps.store);
  const plan = planKeeper(keeper, c.conn.state, c.config, deps.now(), deps.today());
  if (!plan.due) return { sent: false, reason: plan.reason };
  // Counted before the answer: a read that hangs or fails still used its turn.
  await writeKeeper(deps.store, afterAuto(keeper, deps.now(), deps.today()));
  const read = await readFragment(deps.scheduler, plan.fragment, 'sipakamase-keep');
  await settle(deps, c.conn, read);
  return { sent: true, read: read.kind };
}

export type RefreshResult =
  | { kind: 'off' | 'paused' }
  | { kind: 'wait'; retryAt: UnixSeconds }
  | { kind: 'done'; read: number; stoppedBy: FragmentRead['kind'] | null; connection: Connection };

export async function refresh(deps: SipakamaseDeps): Promise<RefreshResult> {
  const c = await current(deps);
  if (!c) return { kind: 'off' };
  if (!c.enabled || c.conn.state === 'paused_remote') return { kind: 'paused' };
  // "Perbarui sekarang" also works after a long pause or a sign-out: it is the user asking.
  let conn = c.conn.state === 'paused_idle' ? await move(deps, c.conn, { kind: 'connect' }) : c.conn;
  const keeper = await readKeeper(deps.store);
  const plan = planRefresh(keeper, deps.now());
  if (!plan.allowed) return { kind: 'wait', retryAt: plan.retryAt };
  await writeKeeper(deps.store, afterRefresh(keeper, deps.now()));
  let read = 0;
  for (const fragment of plan.fragments) {
    const r = await readFragment(deps.scheduler, fragment, 'sipakamase-refresh');
    conn = await settle(deps, conn, r);
    if (r.kind !== 'ok') return { kind: 'done', read, stoppedBy: r.kind, connection: conn };
    read += 1;
  }
  return { kind: 'done', read, stoppedBy: null, connection: conn };
}

/** The passive reader's message, already checked (schema.ts parsePassive). No request. */
export async function passive(deps: SipakamaseDeps, message: PassiveRead): Promise<'stored' | 'login' | 'ignored'> {
  if (message.kind === 'invalid') return 'ignored';
  const c = await current(deps);
  if (!c || !readsAllowed(c.conn.state)) return 'ignored';
  await settle(deps, c.conn, message.kind === 'login' ? { kind: 'login' } : message);
  return message.kind === 'login' ? 'login' : 'stored';
}
