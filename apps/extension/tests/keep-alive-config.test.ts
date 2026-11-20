import { describe, expect, it } from 'vitest';
import { isPublicFetchDue, PUBLIC_MIN_GAP_H } from '@sulo/core/remote/fetch-public';
import { DEFAULT_KEEP_ALIVE, keepAliveFrom, parseKeepAlive } from '@sulo/core/remote/keep-alive';
import { remoteConfigSchema } from '@sulo/core/remote/remote-config';

const H = 3600;
const ok = { enabled: false, dayIntervalMinutes: 30, nightIntervalMinutes: 90, radarEvery: 2, message: { id: 'Dimatikan sementara.', en: 'Off for now.' } };

describe('mobile keep-alive config', () => {
  it('defaults when the section is missing or not an object', () => {
    expect(parseKeepAlive(undefined)).toEqual(DEFAULT_KEEP_ALIVE);
    expect(parseKeepAlive({ backgroundKeepAlive: 'yes' })).toEqual(DEFAULT_KEEP_ALIVE);
    expect(DEFAULT_KEEP_ALIVE).toMatchObject({ enabled: true, dayIntervalMinutes: 20, nightIntervalMinutes: 110, radarEvery: 3 });
  });
  it('reads a valid section as is', () => {
    expect(parseKeepAlive({ backgroundKeepAlive: ok })).toEqual(ok);
  });
  it('a value out of range or of the wrong type takes its default, field by field', () => {
    const r = parseKeepAlive({ backgroundKeepAlive: { enabled: 'no', dayIntervalMinutes: 5, nightIntervalMinutes: 200, radarEvery: 2.5 } });
    expect(r).toEqual(DEFAULT_KEEP_ALIVE);
    expect(parseKeepAlive({ backgroundKeepAlive: { dayIntervalMinutes: 15, nightIntervalMinutes: 110, radarEvery: 6 } })).toMatchObject({ dayIntervalMinutes: 15, nightIntervalMinutes: 110, radarEvery: 6, enabled: true });
    expect(parseKeepAlive({ backgroundKeepAlive: { dayIntervalMinutes: 111, nightIntervalMinutes: 29, radarEvery: 0 } })).toMatchObject({ dayIntervalMinutes: 20, nightIntervalMinutes: 110, radarEvery: 3 });
  });
  it('a message needs both languages', () => {
    expect(parseKeepAlive({ backgroundKeepAlive: { message: { id: 'x' } } }).message).toBeNull();
  });
  it('a broken mobile section never voids the extension config', () => {
    const parsed = remoteConfigSchema.safeParse({ enabled: true, minIntervalMinutes: 180, message: '', mobile: { backgroundKeepAlive: { dayIntervalMinutes: 'fast' } } });
    expect(parsed.success).toBe(true);
    expect(keepAliveFrom({ enabled: true, minIntervalMinutes: 180, message: '', fetchedAt: 1, mobile: parsed.success ? parsed.data.mobile : undefined })).toEqual(DEFAULT_KEEP_ALIVE);
    expect(remoteConfigSchema.safeParse({ enabled: true, minIntervalMinutes: 180, message: '' }).success).toBe(true);
  });
  it('the last stored config is what applies (a failed read keeps it)', () => {
    expect(keepAliveFrom(null)).toEqual(DEFAULT_KEEP_ALIVE);
    expect(keepAliveFrom({ enabled: true, minIntervalMinutes: 180, message: '', fetchedAt: 1, mobile: { backgroundKeepAlive: ok } }).enabled).toBe(false);
  });
});

describe('public file read gap', () => {
  const now = 1_800_000_000;
  it('daily by default (the extension, unchanged)', () => {
    expect(isPublicFetchDue(now - 7 * H, now, 10, 8)).toBe(false);
    expect(isPublicFetchDue(now - PUBLIC_MIN_GAP_H * H, now, 10, 8)).toBe(true);
  });
  it('the phone opened: 6 hours is enough, at any hour', () => {
    expect(isPublicFetchDue(now - 5 * H, now, 2, 8, 6)).toBe(false);
    expect(isPublicFetchDue(now - 7 * H, now, 2, 8, 6)).toBe(true);
  });
});
