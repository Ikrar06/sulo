// The SIKOLA limit test on the Diagnostik screen (owner's decision of 26 Nov
// 2026, docs/ios/uji-singkat-sesi.md): does the keeper's ping count as
// activity? "Mulai" reads the time left without extending the session;
// ten minutes later "Lanjutkan" reads it again, sends one ping (the same
// call with the session updated) and reads once more. Four single-call
// batches in all, through core's client: gates, daily budget and queue.
import { calls } from '@sulo/core/moodle/calls';
import type { Platform } from '@sulo/core/platform';
import { sikolaClient } from '../sync';

export const LIMIT_TEST_KEY = 'mobile:diag:limitTest';
export const LIMIT_TEST_WAIT_SEC = 10 * 60;

export interface LimitTestState {
  startedAt: number;
  first: number;
  result?: { beforePing: number; afterPing: number; doneAt: number };
}

/** A ping counts as activity when the time left came back up by at least five minutes. */
export function pingCounted(beforePing: number, afterPing: number): boolean {
  return afterPing - beforePing >= 300;
}

/** The longest gap in minutes between background checks in the last `windowSec`, or null with fewer than two. */
export function longestGapMin(checks: readonly { ranAt: number }[], now: number, windowSec = 86_400): number | null {
  const times = checks.map((c) => c.ranAt).filter((t) => t > 0 && now - t <= windowSec).sort((a, b) => a - b);
  if (times.length < 2) return null;
  let gap = 0;
  for (let i = 1; i < times.length; i++) gap = Math.max(gap, times[i]! - times[i - 1]!);
  return Math.round(gap / 60);
}

/** SIKOLA's time left in seconds; `extend` sends it as activity (the ping). Null when it could not be read. */
async function timeLeft(platform: Platform, extend: boolean): Promise<number | null> {
  const outcome = await sikolaClient(platform, { userInitiated: extend }).callBatch([calls.sessionTimeRemaining()], { source: 'manual' });
  if (outcome.kind !== 'ok') return null;
  const first = outcome.results[0];
  const value = first?.ok ? (first.data as { timeremaining?: unknown }).timeremaining : undefined;
  return typeof value === 'number' ? value : null;
}

export async function startLimitTest(platform: Platform): Promise<LimitTestState | null> {
  const first = await timeLeft(platform, false);
  if (first === null) return null;
  const state: LimitTestState = { startedAt: platform.clock.now(), first };
  await platform.store.set(LIMIT_TEST_KEY, state);
  return state;
}

export async function finishLimitTest(platform: Platform, state: LimitTestState): Promise<LimitTestState | null> {
  const beforePing = await timeLeft(platform, false);
  if (beforePing === null) return null;
  if ((await timeLeft(platform, true)) === null) return null;
  const afterPing = await timeLeft(platform, false);
  if (afterPing === null) return null;
  const next: LimitTestState = { ...state, result: { beforePing, afterPing, doneAt: platform.clock.now() } };
  await platform.store.set(LIMIT_TEST_KEY, next);
  return next;
}
