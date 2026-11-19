// Performance tier (mobile): "full" or "lite", decided once when the app
// opens from what the phone says about itself (Android's low-RAM flag, total
// RAM, CPU cores). Lite keeps every screen as it looks and only lightens the
// motion. Nothing about the device is stored or sent anywhere: the values
// live in memory for this run only, and the dev screen shows them.

export type PerformanceTier = 'full' | 'lite';

/** The user's choice in Pengaturan > Tampilan > Animasi. */
export type AnimationPref = 'auto' | 'full' | 'lite';
export const ANIMATION_PREFS: readonly AnimationPref[] = ['auto', 'full', 'lite'];

/** What the native side reports; null when it could not tell (web, an old plugin). */
export interface DeviceInfo {
  lowRamDevice: boolean | null;
  totalRamMb: number | null;
  cpuCores: number | null;
  /** The WebView's version string (e.g. "120.0.6099.230"), for the dev screen only. */
  webView: string | null;
}

export type TierReason = 'low_ram_device' | 'ram' | 'cores';

/** 3 GB or less. A 3 GB phone reports a little under 3072 MB; a 4 GB one well above. */
export const LITE_MAX_RAM_MB = 3072;
/** 4 cores or fewer. */
export const LITE_MAX_CORES = 4;

/** Lite when Android flags a low-RAM device, RAM is 3 GB or less, or there are 4 cores or fewer. Unknown values never count. */
export function detectTier(info: DeviceInfo): { tier: PerformanceTier; reasons: TierReason[] } {
  const reasons: TierReason[] = [];
  if (info.lowRamDevice === true) reasons.push('low_ram_device');
  if (info.totalRamMb !== null && info.totalRamMb > 0 && info.totalRamMb <= LITE_MAX_RAM_MB) reasons.push('ram');
  if (info.cpuCores !== null && info.cpuCores > 0 && info.cpuCores <= LITE_MAX_CORES) reasons.push('cores');
  return { tier: reasons.length > 0 ? 'lite' : 'full', reasons };
}

/** The tier in force: the user's choice, or the detected one under "auto". A debug override wins over both. */
export function effectiveTier(pref: AnimationPref, detected: PerformanceTier, override: PerformanceTier | null = null): PerformanceTier {
  if (override) return override;
  return pref === 'auto' ? detected : pref;
}

/** Response motion (sheets, buttons, screen changes) in lite runs at 0.8 of its duration. */
export const LITE_DURATION = 0.8;
export const durationScale = (tier: PerformanceTier): number => (tier === 'lite' ? LITE_DURATION : 1);

/** Parses the plugin's answer at the boundary: anything odd becomes null, never a guess. */
export function parseDeviceInfo(raw: unknown): DeviceInfo {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : null);
  return {
    lowRamDevice: typeof o.lowRamDevice === 'boolean' ? o.lowRamDevice : null,
    totalRamMb: num(o.totalRamMb),
    cpuCores: num(o.cpuCores),
    webView: typeof o.webView === 'string' && o.webView.length > 0 && o.webView.length <= 64 ? o.webView : null,
  };
}
