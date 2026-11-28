import { describe, expect, it } from 'vitest';
import { captureFrom, REFRESH_TAB_KEY, startRefresh } from '@sulo/core/neosia/refresh-tab';
import { memoryStore } from './helpers';

describe('Perbarui dari NEOSIA (extension)', () => {
  it('closes only the tab it opened, once, after its data came in', async () => {
    const session = memoryStore();
    expect(await startRefresh(session, async () => 7, 100)).toBe(true);
    expect(await captureFrom(session, 8, 105)).toBe(false);
    expect(await captureFrom(session, 7, 105)).toBe(true);
    expect(await captureFrom(session, 7, 106)).toBe(false);
  });

  it('stops watching after 30 seconds without data, leaving the tab', async () => {
    const session = memoryStore();
    await startRefresh(session, async () => 7, 100);
    expect(await captureFrom(session, 7, 131)).toBe(false);
    expect(session.dump()[REFRESH_TAB_KEY]).toBeUndefined();
  });

  it('tracks nothing when no tab could open', async () => {
    const session = memoryStore();
    expect(await startRefresh(session, async () => undefined, 100)).toBe(false);
    expect(await captureFrom(session, 7, 101)).toBe(false);
  });
});

describe('the phone\'s scheduled NEOSIA visit', async () => {
  const { visitDue, busyPeriod } = await import('@sulo/core/neosia/visit');
  const k = (kategori: string, mulai: string, selesai: string) => ({ kategori, mulai, selesai }) as never;
  const cal = [k('krs', '2027-01-03', '2027-02-12'), k('nilai', '2026-12-21', '2026-12-27')];
  const base = { consented: true, configAllows: true, moduleOn: true, lastVisitAt: 0, now: 0, today: '2026-11-26', kegiatan: cal };
  const DAY = 86_400;

  it('never without consent, the config, or the module', () => {
    expect(visitDue({ ...base, consented: false, lastVisitAt: null })).toBe(false);
    expect(visitDue({ ...base, configAllows: false, lastVisitAt: null })).toBe(false);
    expect(visitDue({ ...base, moduleOn: false, lastVisitAt: null })).toBe(false);
    expect(visitDue({ ...base, lastVisitAt: null })).toBe(true);
  });

  it('daily in the KRS and grade periods, weekly otherwise', () => {
    expect(busyPeriod(cal, '2027-01-10')).toBe(true);
    expect(busyPeriod(cal, '2026-12-22')).toBe(true);
    expect(busyPeriod(cal, '2026-11-26')).toBe(false);
    expect(visitDue({ ...base, today: '2027-01-10', now: DAY })).toBe(true);
    expect(visitDue({ ...base, now: DAY })).toBe(false);
    expect(visitDue({ ...base, now: 7 * DAY })).toBe(true);
  });
});

describe('NEOSIA session log (debug builds)', async () => {
  const { neosiaSessionHours, noteNeosiaSession, NEOSIA_SESSION_LOG_KEY } = await import('@sulo/core/neosia/session-log');
  it('measures each session from its first sign-in seen to the next login page', async () => {
    const { memoryStore } = await import('./helpers');
    const store = memoryStore();
    for (const [at, event] of [[0, 'signed_in'], [3600, 'signed_in'], [5 * 3600, 'needs_login'], [6 * 3600, 'needs_login'], [7 * 3600, 'signed_in']] as const) await noteNeosiaSession(store, { at, event, via: 'tap' });
    expect(neosiaSessionHours(store.dump()[NEOSIA_SESSION_LOG_KEY] as never)).toEqual([5]);
  });
});
