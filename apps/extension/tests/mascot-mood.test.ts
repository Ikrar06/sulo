import { describe, expect, it } from 'vitest';
import { mascotMood } from '@sulo/core/dashboard/mascot-mood';

const now = 1_800_000_000;
const h = 3600;
const base = { now, sessionExpired: false, offline: false };

describe("mascotMood (the Android app's Ringkasan)", () => {
  it('a running sync is busy, above everything else', () => {
    expect(mascotMood({ now: 1_000_000, dueTimes: [999_000], sessionExpired: true, offline: false, syncing: true }).state).toBe('syncing');
    expect(mascotMood({ now: 1_000_000, dueTimes: [], sessionExpired: false, offline: false, syncing: false }).state).not.toBe('syncing');
  });

  it('an overdue task: urgent', () => {
    expect(mascotMood({ ...base, dueTimes: [now - h, now + 5 * h] })).toEqual({ state: 'urgent', alert: false });
  });
  it('due within 24 hours, nothing overdue: idle and alert', () => {
    expect(mascotMood({ ...base, dueTimes: [now + 23 * h] })).toEqual({ state: 'idle', alert: true });
  });
  it('nothing due in the next 7 days: happy (all-done), also with no tasks', () => {
    expect(mascotMood({ ...base, dueTimes: [now + 8 * 24 * h] })).toEqual({ state: 'all-done', alert: false });
    expect(mascotMood({ ...base, dueTimes: [] })).toEqual({ state: 'all-done', alert: false });
  });
  it('due within the week but not within a day: idle', () => {
    expect(mascotMood({ ...base, dueTimes: [now + 3 * 24 * h] })).toEqual({ state: 'idle', alert: false });
  });
  it('an ended session or no connection wins over everything: sleepy', () => {
    expect(mascotMood({ ...base, sessionExpired: true, dueTimes: [now - h] })).toEqual({ state: 'sleepy', alert: false });
    expect(mascotMood({ ...base, offline: true, dueTimes: [now + h] })).toEqual({ state: 'sleepy', alert: false });
  });
  it('the edges: exactly now counts as due within a day, exactly 7 days as within the week', () => {
    expect(mascotMood({ ...base, dueTimes: [now] }).state).toBe('idle');
    expect(mascotMood({ ...base, dueTimes: [now + 7 * 24 * h - 1] }).state).toBe('idle');
    expect(mascotMood({ ...base, dueTimes: [now + 7 * 24 * h] }).state).toBe('all-done');
  });
});
