import { describe, expect, it } from 'vitest';
import { mkpkReminders } from '@sulo/core/mkpk/reminders';
import { summarizeSipakamase } from '@sulo/core/mkpk/sipakamase-summary';
import { EMPTY_DATA, type SipakamaseData } from '@sulo/core/sipakamase/store';

const act = (name: string, extra: Record<string, unknown> = {}) => ({ semester: 'Awal 2026/2027', basis: 'kompetisi' as const, kind: 'Lomba', name, status: 'done' as const, statusText: 'Terlaksana', hasCompanion: true, hasScore: false, ...extra });
const data = (parts: SipakamaseData['parts']): SipakamaseData => ({ ...EMPTY_DATA, readAt: { claim: 500 }, parts });
const line = (code: string, name: string, sks = 2) => ({ code, name, sks });

describe('MKPK reminders', () => {
  const parts: SipakamaseData['parts'] = {
    running: [act('Lomba Esai', { hasCompanion: false }), act('Panitia', { hasCompanion: true })],
    claim: {
      passed: [{ code: '23U02130202', name: 'Manajemen Kegiatan', sks: 2, inNeosia: false }],
      programmed: [{ code: '23U02130202', kind: 'mkpk' }, { code: '23U02131102', kind: 'mkpk' }],
    },
    courses: {
      passed: [{ name: 'Manajemen Kegiatan', sks: 2, collected: 2 }, { name: 'Pemecahan Masalah', sks: 2, collected: 2 }, { name: 'Empati Sosial', sks: 2, collected: 2 }],
      notPassed: [],
    },
    conversions: [{ name: 'Lomba Esai', sksTotal: 0.58, sksUnconverted: 0.58 }, { name: 'Panitia', sksTotal: 3.2, sksUnconverted: 0.92 }],
  };
  const progress = { enrolled: [line('23U02131102', 'Kepemimpinan Inovatif'), line('23U02130202', 'Manajemen Kegiatan')], passed: [line('23U02133002', 'Empati Sosial')] };

  it('finds each of a to e, once', () => {
    expect(mkpkReminders(data(parts), progress)).toEqual([
      { kind: 'a', name: 'Kepemimpinan Inovatif' },
      { kind: 'b', name: 'Manajemen Kegiatan' },
      { kind: 'c', name: 'Pemecahan Masalah' },
      { kind: 'd', sks: 1.5, activities: 2 },
      { kind: 'e', name: 'Lomba Esai' },
    ]);
  });

  it('says nothing about the KRS before Sipakamase was read, and nothing at all without its data', () => {
    expect(mkpkReminders(data({}), progress)).toEqual([]);
    expect(mkpkReminders(null, progress)).toEqual([]);
  });

  it('matches names regardless of case and spacing', () => {
    const r = mkpkReminders(data({ ...parts, claim: { ...parts.claim!, passed: [{ code: null, name: 'kepemimpinan  inovatif', sks: 2, inNeosia: true }] } }), progress);
    // Both enrolled courses are passed now: one by its claim row (another spelling), one by the course list.
    expect(r.filter((x) => x.kind === 'a')).toEqual([]);
  });
});

describe('Sipakamase summary on the card', () => {
  it('adds up credits not in NEOSIA and not converted, without floating-point dust', () => {
    const s = summarizeSipakamase(
      data({
        claim: { passed: [{ code: null, name: 'a', sks: 2, inNeosia: false }, { code: null, name: 'b', sks: 2, inNeosia: true }], programmed: [] },
        conversions: [{ name: 'x', sksTotal: 1, sksUnconverted: 0.58 }, { name: 'y', sksTotal: 3, sksUnconverted: 0.92 }, { name: 'z', sksTotal: 1, sksUnconverted: 0 }],
      }),
      { state: 'live', since: 1, cause: 'read_ok' },
    );
    expect(s).toMatchObject({ connected: true, readAt: 500, notInNeosiaSks: 2, unconvertedSks: 1.5, unconvertedActivities: 2 });
  });

  it('is empty when not connected, and unknown parts stay null', () => {
    expect(summarizeSipakamase(null, { state: 'off', since: 0, cause: null })).toMatchObject({ connected: false, notInNeosiaSks: null, unconvertedSks: null });
    expect(summarizeSipakamase(data({}), { state: 'needs_login', since: 0, cause: 'connect' })).toMatchObject({ connected: true, notInNeosiaSks: null, unconvertedSks: null });
  });
});
