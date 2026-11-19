// The performance tier in force (core perf/tier.ts). The device is read once
// when the app opens (SuloSession.deviceInfo) and kept in memory for this
// run only: nothing about the phone is stored or sent. The tier shows as
// data-perf on <html> ("full" or "lite") so CSS can lighten the motion, and
// --m-dur scales response motion (sheets, buttons, screen changes) by 0.8
// in lite. Debug builds can force a tier from the dev screen.

import { detectTier, durationScale, effectiveTier, parseDeviceInfo, type AnimationPref, type DeviceInfo, type PerformanceTier, type TierReason } from '@sulo/core/perf/tier';
import type { KeyValueStore } from '@sulo/core/platform';
import { useSyncExternalStore } from 'react';
import { SuloSession } from './session';

/** Debug builds only: a forced tier for testing, kept on the phone. */
export const PERF_OVERRIDE_KEY = 'mobile:dev:perfTier';

const UNKNOWN: DeviceInfo = { lowRamDevice: null, totalRamMb: null, cpuCores: null, webView: null };

interface PerfState {
  device: DeviceInfo;
  detected: PerformanceTier;
  reasons: TierReason[];
  pref: AnimationPref;
  override: PerformanceTier | null;
  tier: PerformanceTier;
}

let state: PerfState = { device: UNKNOWN, detected: 'full', reasons: [], pref: 'auto', override: null, tier: 'full' };
const listeners = new Set<() => void>();

export const perfState = (): PerfState => state;
export const perfTier = (): PerformanceTier => state.tier;
export const isLite = (): boolean => state.tier === 'lite';
/** Multiplies a response-motion duration (ms) for the tier in force. */
export const dur = (ms: number): number => Math.round(ms * durationScale(state.tier));

export function onPerfChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function apply(next: Omit<PerfState, 'tier'>): void {
  const tier = effectiveTier(next.pref, next.detected, next.override);
  state = { ...next, tier };
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.perf = tier;
    document.documentElement.style.setProperty('--m-dur', String(durationScale(tier)));
  }
  listeners.forEach((fn) => fn());
}

/** Once at start: reads the device, then applies the user's choice (and a debug override). */
export async function initPerf(store: KeyValueStore, pref: AnimationPref): Promise<void> {
  const device = parseDeviceInfo(await Promise.resolve().then(() => SuloSession.deviceInfo()).catch(() => null));
  const { tier: detected, reasons } = detectTier(device);
  // The web build and the measuring APK also take ?perf=full|lite (scripts/perf-measure.mjs).
  const query = __SULO_WEB_FAKE__ && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('perf') : null;
  // Kept like the dev screen's choice, so the measuring APK's cold opens stay in that tier.
  if (query === 'full' || query === 'lite') await store.set(PERF_OVERRIDE_KEY, query).catch(() => undefined);
  const raw = query ?? (__SULO_DEV__ ? await store.get<unknown>(PERF_OVERRIDE_KEY).catch(() => null) : null);
  const override = raw === 'full' || raw === 'lite' ? raw : null;
  apply({ device, detected, reasons, pref, override });
}

/** Pengaturan > Tampilan > Animasi changed. */
export function setAnimationPref(pref: AnimationPref): void {
  if (pref !== state.pref) apply({ ...state, pref });
}

/** Dev screen: force a tier (null: back to the choice). */
export async function setPerfOverride(store: KeyValueStore, override: PerformanceTier | null): Promise<void> {
  if (!__SULO_DEV__) return;
  if (override) await store.set(PERF_OVERRIDE_KEY, override);
  else await store.remove(PERF_OVERRIDE_KEY);
  apply({ ...state, override });
}

/** The tier in force, re-rendering when it changes (Animasi setting, dev override). */
export function usePerfTier(): PerformanceTier {
  return useSyncExternalStore(onPerfChange, perfTier, perfTier);
}
