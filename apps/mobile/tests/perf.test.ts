// The performance tier in the app (src/perf.ts): read once at start, the
// Animasi choice and the dev override applied, nothing about the phone
// stored; and the 40-card rule for long lists (screens/LongList.tsx).
import { beforeEach, describe, expect, it, vi } from 'vitest';

let reply: unknown = {};
vi.mock('../src/session', () => ({ SuloSession: { deviceInfo: async () => reply } }));

const stored = new Map<string, unknown>();
const store = {
  get: async <T,>(k: string) => (stored.get(k) as T) ?? null,
  set: async (k: string, v: unknown) => void stored.set(k, v),
  remove: async (k: string) => void stored.delete(k),
} as never;

const perf = await import('../src/perf');
const { offscreenRow, LONG_LIST_ROWS } = await import('../src/screens/LongList');

describe('performance tier in the app', () => {
  beforeEach(() => stored.clear());

  it('a 2 GB, 4-core phone opens in lite; durations run at 0.8', async () => {
    reply = { lowRamDevice: true, totalRamMb: 1900, cpuCores: 4, webView: '83.0' };
    await perf.initPerf(store, 'auto');
    expect(perf.perfTier()).toBe('lite');
    expect(perf.perfState().reasons).toEqual(['low_ram_device', 'ram', 'cores']);
    expect(perf.dur(340)).toBe(272);
  });

  it('a capable phone opens in full; the Animasi choice wins over detection', async () => {
    reply = { lowRamDevice: false, totalRamMb: 7600, cpuCores: 8 };
    await perf.initPerf(store, 'auto');
    expect(perf.perfTier()).toBe('full');
    expect(perf.dur(340)).toBe(340);
    perf.setAnimationPref('lite');
    expect(perf.perfTier()).toBe('lite');
    perf.setAnimationPref('auto');
    expect(perf.perfTier()).toBe('full');
  });

  it('no plugin answer: full, with nothing guessed', async () => {
    reply = Promise.reject(new Error('not implemented'));
    await perf.initPerf(store, 'auto');
    expect(perf.perfTier()).toBe('full');
    expect(perf.perfState().device.totalRamMb).toBeNull();
  });

  it('nothing about the device is stored; only a dev override is kept, and it wins', async () => {
    reply = { lowRamDevice: false, totalRamMb: 7600, cpuCores: 8 };
    await perf.initPerf(store, 'auto');
    expect([...stored.keys()]).toEqual([]);
    await perf.setPerfOverride(store, 'lite');
    expect(perf.perfTier()).toBe('lite');
    expect([...stored.entries()]).toEqual([[perf.PERF_OVERRIDE_KEY, 'lite']]);
    await perf.initPerf(store, 'full');
    expect(perf.perfTier()).toBe('lite');
    await perf.setPerfOverride(store, null);
    expect(perf.perfTier()).toBe('full');
    expect(stored.size).toBe(0);
  });

  it('lists over 40 cards skip off-screen rows; shorter lists are untouched', () => {
    expect(LONG_LIST_ROWS).toBe(40);
    expect(offscreenRow(40, 64)).toBeUndefined();
    expect(offscreenRow(41, 64)).toEqual({ contentVisibility: 'auto', containIntrinsicSize: 'auto 64px' });
  });
});
