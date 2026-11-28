// The extension's "Pantau tugas baru" (1.1.0), as set from the public config
// (config.json, extension.backgroundWatch). Read field by field, like the
// phone's backgroundKeepAlive (remote/keep-alive.ts): a value missing, of the
// wrong type or out of range takes its default, so one bad field never turns
// the feature off or on by accident. The owner can stop it everywhere
// (enabled false) or slow it down; never speed it up past moodle/limits.ts.

import { EXTENSION_WATCH } from '../moodle/limits';
import type { RemoteConfig } from '../types';

export interface ExtensionWatchConfig {
  enabled: boolean;
  activeIntervalMinutes: number;
  idleIntervalMinutes: number;
}

export const DEFAULT_EXTENSION_WATCH: ExtensionWatchConfig = {
  enabled: true,
  activeIntervalMinutes: EXTENSION_WATCH.activeMinutes,
  idleIntervalMinutes: EXTENSION_WATCH.idleMinutes,
};

function inRange(value: unknown, limits: { min: number; max: number }, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= limits.min && value <= limits.max ? value : fallback;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** extension.backgroundWatch from a raw `extension` section; anything unreadable is the default. */
export function parseExtensionWatch(extension: unknown): ExtensionWatchConfig {
  const raw = isObject(extension) ? extension.backgroundWatch : undefined;
  if (!isObject(raw)) return DEFAULT_EXTENSION_WATCH;
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_EXTENSION_WATCH.enabled,
    activeIntervalMinutes: inRange(raw.activeIntervalMinutes, EXTENSION_WATCH.limits.activeMinutes, DEFAULT_EXTENSION_WATCH.activeIntervalMinutes),
    idleIntervalMinutes: inRange(raw.idleIntervalMinutes, EXTENSION_WATCH.limits.idleMinutes, DEFAULT_EXTENSION_WATCH.idleIntervalMinutes),
  };
}

/** The settings in force: from the last stored config (its last good read), or the defaults. */
export function extensionWatchFrom(config: RemoteConfig | null): ExtensionWatchConfig {
  return parseExtensionWatch(config?.extension);
}
