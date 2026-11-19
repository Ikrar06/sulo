// The watch worker's own reading of the public config (M8c.3, closing
// work): the kill switch is obeyed without the app being opened. This file
// is the reference the native worker (WatchRemote.kt) follows, tested on
// the shared vectors (vectors.json: remoteParse, remoteDecide).
//
//   - The worker reads config.json itself, at most once per 6 hours (the
//     app's own reads count toward that gap), with If-None-Match. It is the
//     only request besides SIKOLA; it carries the Sulo user agent and
//     nothing about the user.
//   - A 200 is validated exactly like the app does (remoteConfigSchema,
//     then mobile.backgroundKeepAlive field by field). Broken JSON, a schema
//     failure or any other status is a failed read, never permission; a 304
//     confirms the last good config.
//   - Off (global enabled false or backgroundKeepAlive.enabled false):
//     nothing goes to SIKOLA; the chain stays alive every 6 hours only to
//     read the config again, so watching resumes without the app.
//   - No successful read (worker or app) for 72 hours: nothing goes to
//     SIKOLA until one succeeds.
//   - The app not opened for 7 days: the chain stops with one calm notice.
//   - Otherwise the intervals and the Radar rotation come from the config.

import { parseKeepAlive } from '../remote/keep-alive';
import { remoteConfigSchema } from '../remote/remote-config';
import type { UnixSeconds } from '../types';
import { SOFT_DAY_INTERVAL_MIN } from './plan';

export const CONFIG_READ_GAP_SEC = 6 * 3600;
export const CONFIG_MAX_AGE_SEC = 72 * 3600;
export const APP_PAUSE_SEC = 7 * 86_400;
/** While held (off, or no fresh config), the chain only wakes to read the config. */
export const HOLD_INTERVAL_MIN = 360;

export interface WorkerConfig {
  globalEnabled: boolean;
  keepAlive: { enabled: boolean; dayIntervalMinutes: number; nightIntervalMinutes: number; radarEvery: number };
}

export type ConfigRead = { kind: 'ok'; config: WorkerConfig } | { kind: 'not_modified' } | { kind: 'failed' };

/** One response of config.json, as the worker gets it (status and body text). */
export function parseConfigResponse(status: number, body: string | null): ConfigRead {
  if (status === 304) return { kind: 'not_modified' };
  if (status !== 200 || body === null) return { kind: 'failed' };
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return { kind: 'failed' };
  }
  const parsed = remoteConfigSchema.safeParse(json);
  if (!parsed.success) return { kind: 'failed' };
  const k = parseKeepAlive(parsed.data.mobile);
  return { kind: 'ok', config: { globalEnabled: parsed.data.enabled, keepAlive: { enabled: k.enabled, dayIntervalMinutes: k.dayIntervalMinutes, nightIntervalMinutes: k.nightIntervalMinutes, radarEvery: k.radarEvery } } };
}

/** A read is due when the last one (the worker's or the app's) is 6 hours old or more. */
export const configReadDue = (lastReadAt: UnixSeconds, now: UnixSeconds): boolean => now - lastReadAt >= CONFIG_READ_GAP_SEC;

export interface RemoteState {
  now: UnixSeconds;
  /** When the app last wrote a plan (it does so whenever it is open). */
  lastAppAt: UnixSeconds;
  /** The last successful read (a valid 200 or a 304), the worker's or the app's; 0: never. */
  configOkAt: UnixSeconds;
  /** The last good config; null: none yet. */
  config: WorkerConfig | null;
}

export type RemoteDecision =
  | { action: 'paused' }
  | { action: 'hold'; reason: 'no_config' | 'stale_config' | 'global_off' | 'keepalive_off'; intervalMin: number }
  | { action: 'check'; schedule: { dayIntervalMin: number; nightIntervalMin: number; softDayIntervalMin: number; radarEvery: number } };

/** What the worker may do now, after any due read has been made. */
export function decideRemote(s: RemoteState): RemoteDecision {
  if (s.now - s.lastAppAt >= APP_PAUSE_SEC) return { action: 'paused' };
  if (s.config === null || s.configOkAt <= 0) return { action: 'hold', reason: 'no_config', intervalMin: HOLD_INTERVAL_MIN };
  if (s.now - s.configOkAt >= CONFIG_MAX_AGE_SEC) return { action: 'hold', reason: 'stale_config', intervalMin: HOLD_INTERVAL_MIN };
  if (!s.config.globalEnabled) return { action: 'hold', reason: 'global_off', intervalMin: HOLD_INTERVAL_MIN };
  if (!s.config.keepAlive.enabled) return { action: 'hold', reason: 'keepalive_off', intervalMin: HOLD_INTERVAL_MIN };
  const k = s.config.keepAlive;
  return { action: 'check', schedule: { dayIntervalMin: k.dayIntervalMinutes, nightIntervalMin: k.nightIntervalMinutes, softDayIntervalMin: Math.max(SOFT_DAY_INTERVAL_MIN, k.dayIntervalMinutes), radarEvery: k.radarEvery } };
}
