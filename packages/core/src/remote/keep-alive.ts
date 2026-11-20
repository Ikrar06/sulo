// The Android app's background watching ("Pantau tugas baru"), as set from
// the public config (config.json, mobile.backgroundKeepAlive). Read field
// by field: a value missing, of the wrong type or out of range takes its
// default, so one bad field never turns the feature off or on by accident.
// The owner can stop it everywhere (enabled false) or slow it down.

import type { RemoteConfig } from '../types';

export interface KeepAliveConfig {
  enabled: boolean;
  /** 06.00-22.59 device time. */
  dayIntervalMinutes: number;
  /** 23.00-05.59 device time. */
  nightIntervalMinutes: number;
  /** Radar rides on every n-th daytime check. */
  radarEvery: number;
  /** Shown under the switch while enabled is false. */
  message: { id: string; en: string } | null;
}

export const DEFAULT_KEEP_ALIVE: KeepAliveConfig = { enabled: true, dayIntervalMinutes: 20, nightIntervalMinutes: 110, radarEvery: 3, message: null };

export const KEEP_ALIVE_LIMITS = {
  dayIntervalMinutes: { min: 15, max: 110 },
  nightIntervalMinutes: { min: 30, max: 110 },
  radarEvery: { min: 1, max: 6 },
} as const;

const MESSAGE_MAX = 200;

function inRange(value: unknown, limits: { min: number; max: number }, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= limits.min && value <= limits.max ? value : fallback;
}

function message(value: unknown): KeepAliveConfig['message'] {
  if (typeof value !== 'object' || value === null) return null;
  const { id, en } = value as Record<string, unknown>;
  if (typeof id !== 'string' || typeof en !== 'string' || id.trim() === '' || en.trim() === '') return null;
  return { id: id.slice(0, MESSAGE_MAX), en: en.slice(0, MESSAGE_MAX) };
}

/** mobile.backgroundKeepAlive from a raw `mobile` section; anything unreadable is the default. */
export function parseKeepAlive(mobile: unknown): KeepAliveConfig {
  const raw = typeof mobile === 'object' && mobile !== null ? (mobile as Record<string, unknown>).backgroundKeepAlive : undefined;
  if (typeof raw !== 'object' || raw === null) return DEFAULT_KEEP_ALIVE;
  const r = raw as Record<string, unknown>;
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : DEFAULT_KEEP_ALIVE.enabled,
    dayIntervalMinutes: inRange(r.dayIntervalMinutes, KEEP_ALIVE_LIMITS.dayIntervalMinutes, DEFAULT_KEEP_ALIVE.dayIntervalMinutes),
    nightIntervalMinutes: inRange(r.nightIntervalMinutes, KEEP_ALIVE_LIMITS.nightIntervalMinutes, DEFAULT_KEEP_ALIVE.nightIntervalMinutes),
    radarEvery: inRange(r.radarEvery, KEEP_ALIVE_LIMITS.radarEvery, DEFAULT_KEEP_ALIVE.radarEvery),
    message: message(r.message),
  };
}

/** The keep-alive settings in force: from the last stored config (its last good read), or the defaults. */
export function keepAliveFrom(config: RemoteConfig | null): KeepAliveConfig {
  return parseKeepAlive(config?.mobile);
}
