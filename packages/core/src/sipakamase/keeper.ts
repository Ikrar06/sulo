// When Sulo may read Sipakamase on its own (docs/mkpk/RENCANA.md 4b):
//
// - The keeper: one GET every 3 hours (slower from the config), rotating over
//   the five fragments, only while something is waited for (the connection
//   is `live` or `broken`; `resting` stops it), at most 10 a day.
// - "Perbarui sekarang": all five in order, at most once every 2 minutes.
//
// Pure: the caller passes the stored state and the clock's values.

import type { KeyValueStore, UnixSeconds } from '../types';
import type { SipakamaseSourceConfig } from '../remote/sources';
import { keeperRuns, type ConnState } from './connection';
import { FRAGMENTS, SIPAKAMASE_DATA_PREFIX, type FragmentId } from './store';

export const KEEPER = {
  /** The keeper's automatic reads per local day, whatever the config says. */
  dailyMax: 10,
  /** A read due this much early still runs (an alarm or a worker wakes a little early). */
  slackSec: 5 * 60,
  /** Between two "Perbarui sekarang". */
  refreshGapSec: 2 * 60,
} as const;

/** Two most-changing first: activities in progress, then the history. */
export const KEEP_ORDER: readonly FragmentId[] = ['running', 'history', 'courses', 'claim', 'conversions'];

export interface KeeperState {
  /** Index into KEEP_ORDER of the next automatic read. */
  next: number;
  /** Local date (YYYY-MM-DD) of `autoCount`. */
  autoDate: string;
  autoCount: number;
  lastAutoAt: UnixSeconds | null;
  lastRefreshAt: UnixSeconds | null;
}

export const KEEPER_KEY = `${SIPAKAMASE_DATA_PREFIX}keeper`;
export const START: KeeperState = { next: 0, autoDate: '', autoCount: 0, lastAutoAt: null, lastRefreshAt: null };

export type KeeperPlan =
  | { due: true; fragment: FragmentId }
  | { due: false; reason: 'source_off' | 'keep_off' | 'not_waiting' | 'not_yet' | 'daily_max' };

export function planKeeper(state: KeeperState, conn: ConnState, config: SipakamaseSourceConfig, now: UnixSeconds, today: string): KeeperPlan {
  if (!config.enabled) return { due: false, reason: 'source_off' };
  if (!config.keep) return { due: false, reason: 'keep_off' };
  if (!keeperRuns(conn)) return { due: false, reason: 'not_waiting' };
  if (state.lastAutoAt !== null && now - state.lastAutoAt < config.keepIntervalMinutes * 60 - KEEPER.slackSec) return { due: false, reason: 'not_yet' };
  if (state.autoDate === today && state.autoCount >= KEEPER.dailyMax) return { due: false, reason: 'daily_max' };
  return { due: true, fragment: KEEP_ORDER[state.next % KEEP_ORDER.length]! };
}

/** After an automatic read was sent (whatever its answer): the count and the rotation move on. */
export function afterAuto(state: KeeperState, now: UnixSeconds, today: string): KeeperState {
  return {
    ...state,
    next: (state.next + 1) % KEEP_ORDER.length,
    autoDate: today,
    autoCount: state.autoDate === today ? state.autoCount + 1 : 1,
    lastAutoAt: now,
  };
}

export type RefreshPlan = { allowed: true; fragments: readonly FragmentId[] } | { allowed: false; retryAt: UnixSeconds };

export function planRefresh(state: KeeperState, now: UnixSeconds): RefreshPlan {
  if (state.lastRefreshAt !== null && now - state.lastRefreshAt < KEEPER.refreshGapSec) return { allowed: false, retryAt: state.lastRefreshAt + KEEPER.refreshGapSec };
  return { allowed: true, fragments: FRAGMENTS };
}

/** A refresh read every fragment: the keeper's own clock starts again from it. */
export const afterRefresh = (state: KeeperState, now: UnixSeconds): KeeperState => ({ ...state, lastRefreshAt: now, lastAutoAt: now });

export async function readKeeper(store: KeyValueStore): Promise<KeeperState> {
  const raw = await store.get<KeeperState>(KEEPER_KEY);
  return raw && Number.isInteger(raw.next) && typeof raw.autoDate === 'string' && Number.isInteger(raw.autoCount) ? { ...START, ...raw } : START;
}

export const writeKeeper = (store: KeyValueStore, state: KeeperState) => store.set(KEEPER_KEY, state);
