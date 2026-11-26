// Per campus system, from the public config (config.json, `sources`), 1.1.0.
// Read field by field like remote/extension-watch.ts: a value missing, of the
// wrong type or out of range takes its default. A switch that is there but
// not a boolean makes the whole file invalid (remote/switches.ts). The owner
// can stop each source everywhere or slow it down, never speed it up.

import type { RemoteConfig } from '../types';

export const SIPAKAMASE_KEEP_LIMITS = { min: 180, max: 720 } as const;

export interface SipakamaseSourceConfig {
  /** False: no request to Sipakamase at all, not even "Perbarui sekarang" (paused_remote). */
  enabled: boolean;
  /** False: the keeper stops; the button and the passive reader still work. */
  keep: boolean;
  /** Minutes between the keeper's reads. */
  keepIntervalMinutes: number;
}

export interface NeosiaSourceConfig {
  /** The phone's scheduled NEOSIA visit (1.1.0). */
  scheduledVisit: boolean;
}

export interface SourcesConfig {
  sipakamase: SipakamaseSourceConfig;
  neosia: NeosiaSourceConfig;
}

export const DEFAULT_SOURCES: SourcesConfig = {
  sipakamase: { enabled: true, keep: true, keepIntervalMinutes: SIPAKAMASE_KEEP_LIMITS.min },
  neosia: { scheduledVisit: true },
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const inRange = (v: unknown, limits: { min: number; max: number }, fallback: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= limits.min && v <= limits.max ? v : fallback;

export function parseSources(raw: unknown): SourcesConfig {
  const s = isObject(raw) ? raw : {};
  const sip = isObject(s.sipakamase) ? s.sipakamase : {};
  const neo = isObject(s.neosia) ? s.neosia : {};
  const d = DEFAULT_SOURCES;
  return {
    sipakamase: {
      enabled: bool(sip.enabled, d.sipakamase.enabled),
      keep: bool(sip.keep, d.sipakamase.keep),
      keepIntervalMinutes: inRange(sip.keepIntervalMinutes, SIPAKAMASE_KEEP_LIMITS, d.sipakamase.keepIntervalMinutes),
    },
    neosia: { scheduledVisit: bool(neo.scheduledVisit, d.neosia.scheduledVisit) },
  };
}

/**
 * The settings in force. The global switch (`enabled: false`) stops every
 * source too: Sulo as a whole is paused.
 */
export function sourcesFrom(config: RemoteConfig | null): SourcesConfig {
  const parsed = parseSources(config?.sources);
  if (config && !config.enabled) {
    return { sipakamase: { ...parsed.sipakamase, enabled: false, keep: false }, neosia: { scheduledVisit: false } };
  }
  return parsed;
}
