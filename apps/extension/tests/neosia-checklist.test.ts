import { describe, expect, it } from 'vitest';
import { nextStep, sourcesDone } from '@sulo/core/neosia/checklist';

const next = (signedIn: boolean, lastResult: Parameters<typeof nextStep>[0]['lastResult'], captured: string[]) => nextStep({ signedIn, lastResult, done: sourcesDone(captured) });

describe('the NEOSIA checklist moves on as pages are captured (sources.ts mapping)', () => {
  it('signs in first', () => {
    expect(next(false, null, [])).toBe('login');
  });

  it('after signing in: Beranda, then KHS (both required), then the optional KRS, then done', () => {
    expect(next(true, 'signed_in', [])).toBe('beranda');
    // What Beranda captured on the phone (20 Nov 2026).
    const beranda = ['prodi_semester/active', 'checkJadwalBelanjaKRS', 'dashboard', 'belanja_krs'];
    expect(next(true, 'closed', beranda)).toBe('khs');
    // KHS needs both the transcript and the semester list.
    expect(next(true, 'closed', [...beranda, 'getTranskripMahasiswa'])).toBe('khs');
    expect(next(true, 'closed', [...beranda, 'getTranskripMahasiswa', 'mahasiswa/semester'])).toBe('krs');
    expect(next(true, 'closed', [...beranda, 'getTranskripMahasiswa', 'mahasiswa/semester', 'max_sks'])).toBe('done');
  });

  it('a page that reached the login sends back to signing in', () => {
    expect(next(true, 'needs_login', ['dashboard', 'belanja_krs'])).toBe('login');
  });

  it('done from endpoint ids: every required response of a source', () => {
    expect([...sourcesDone(['dashboard'])]).toEqual([]);
    expect([...sourcesDone(['dashboard', 'belanja_krs', 'max_sks'])].sort()).toEqual(['beranda', 'krs']);
  });
});
