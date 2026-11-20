import { describe, expect, it } from 'vitest';
import { nextStep, pagesDone } from '@sulo/core/neosia/checklist';

describe('the NEOSIA checklist moves on as pages are captured', () => {
  it('signs in first', () => {
    expect(nextStep({ signedIn: false, lastResult: null, capturedEndpoints: [] })).toBe('login');
  });

  it('after signing in: Beranda, then KHS, then KRS, then done', () => {
    expect(nextStep({ signedIn: true, lastResult: 'signed_in', capturedEndpoints: [] })).toBe('home');
    // What Beranda captured on the phone (20 Nov 2026): belanja_krs there does not count for KRS.
    const beranda = ['prodi_semester/active', 'checkJadwalBelanjaKRS', 'dashboard', 'belanja_krs'];
    expect(nextStep({ signedIn: true, lastResult: 'closed', capturedEndpoints: beranda })).toBe('khs');
    expect(nextStep({ signedIn: true, lastResult: 'closed', capturedEndpoints: [...beranda, 'kartu_hasil_studi/semester'] })).toBe('krs');
    expect(nextStep({ signedIn: true, lastResult: 'closed', capturedEndpoints: [...beranda, 'indeks_prestasi/current', 'max_sks'] })).toBe('done');
  });

  it('a page that reached the login sends back to signing in', () => {
    expect(nextStep({ signedIn: true, lastResult: 'needs_login', capturedEndpoints: ['dashboard'] })).toBe('login');
  });

  it('pages done from endpoint ids', () => {
    expect([...pagesDone(['dashboard', 'kelas_kuliah_tersedia'])].sort()).toEqual(['home', 'krs']);
  });
});
