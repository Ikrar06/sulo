import { describe, expect, it } from 'vitest';
import { detectTier, durationScale, effectiveTier, parseDeviceInfo, type DeviceInfo } from '@sulo/core/perf/tier';

const phone = (p: Partial<DeviceInfo>): DeviceInfo => ({ lowRamDevice: false, totalRamMb: 7600, cpuCores: 8, webView: '120.0', ...p });

describe('performance tier', () => {
  it('a mid-range phone is full', () => {
    expect(detectTier(phone({}))).toEqual({ tier: 'full', reasons: [] });
  });
  it('Android low-RAM flag, 3 GB or less, or 4 cores or fewer make it lite', () => {
    expect(detectTier(phone({ lowRamDevice: true })).reasons).toEqual(['low_ram_device']);
    expect(detectTier(phone({ totalRamMb: 2850 })).tier).toBe('lite');
    expect(detectTier(phone({ totalRamMb: 3072 })).tier).toBe('lite');
    expect(detectTier(phone({ totalRamMb: 3700 })).tier).toBe('full');
    expect(detectTier(phone({ cpuCores: 4 })).reasons).toEqual(['cores']);
    expect(detectTier(phone({ lowRamDevice: true, totalRamMb: 1900, cpuCores: 4 })).reasons).toEqual(['low_ram_device', 'ram', 'cores']);
  });
  it('unknown values never count (web, old plugin)', () => {
    expect(detectTier({ lowRamDevice: null, totalRamMb: null, cpuCores: null, webView: null }).tier).toBe('full');
  });
  it('the choice: auto follows detection, full and lite force it, a debug override wins', () => {
    expect(effectiveTier('auto', 'lite')).toBe('lite');
    expect(effectiveTier('full', 'lite')).toBe('full');
    expect(effectiveTier('lite', 'full')).toBe('lite');
    expect(effectiveTier('full', 'full', 'lite')).toBe('lite');
    expect(durationScale('lite')).toBe(0.8);
    expect(durationScale('full')).toBe(1);
  });
  it('parses the plugin answer defensively', () => {
    expect(parseDeviceInfo({ lowRamDevice: true, totalRamMb: 1987.6, cpuCores: 4, webView: '58.0.3029.125' })).toEqual({ lowRamDevice: true, totalRamMb: 1988, cpuCores: 4, webView: '58.0.3029.125' });
    expect(parseDeviceInfo({ lowRamDevice: 'yes', totalRamMb: -1, cpuCores: Number.NaN, webView: 'x'.repeat(65) })).toEqual({ lowRamDevice: null, totalRamMb: null, cpuCores: null, webView: null });
    expect(parseDeviceInfo(null).totalRamMb).toBeNull();
  });
});
