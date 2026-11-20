// M8d B3/B4: grades stay out of what every screen sees, the credits target
// stays in range, and the browser stand-in for SuloNeosia (screenshots)
// serves only synthetic data, page by page.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { GRADE_ENDPOINTS, parseSksTarget, withoutGrades } from '../src/neosia/grade-guard';

describe('withoutGrades', () => {
  it('drops every GPA field at any depth and keeps the rest', () => {
    const dash = { indeks_prestasi: { ipk: 3.5, jumlah_sks_dilulusi: 40 }, masa_studi: { sisa: 8 }, list: [{ ips: 3.1, sks: 3 }], IPK: 3.2, cur: { indeks_prestasi_kumulatif: 3.4, indeks_prestasi_semester: 3.0 } };
    // The passed credits stay (the Studi card shows them even with grades hidden).
    expect(withoutGrades(dash)).toEqual({ indeks_prestasi: { jumlah_sks_dilulusi: 40 }, masa_studi: { sisa: 8 }, list: [{ sks: 3 }], cur: {} });
  });
  it('leaves primitives and null alone', () => {
    expect(withoutGrades(null)).toBeNull();
    expect(withoutGrades(3)).toBe(3);
  });
  it('names the three grade endpoints', () => {
    expect([...GRADE_ENDPOINTS].sort()).toEqual(['getTranskripMahasiswa', 'indeks_prestasi/current', 'kartu_hasil_studi/semester']);
  });
});

describe('parseSksTarget', () => {
  it('takes whole numbers from 100 to 200', () => {
    expect(parseSksTarget('144')).toBe(144);
    expect(parseSksTarget(' 100 ')).toBe(100);
    expect(parseSksTarget('200')).toBe(200);
  });
  it('refuses anything else', () => {
    for (const t of ['99', '201', '14.5', '', 'abc', '1e2', '-144']) expect(parseSksTarget(t)).toBeNull();
  });
});

describe('fake SuloNeosia', () => {
  afterEach(() => vi.unstubAllGlobals());
  const at = async (stage: string) => {
    vi.stubGlobal('location', { search: `?neosia=${stage}` });
    vi.resetModules();
    return (await import('../src/fake/neosia')).fakeNeosia();
  };

  it('beranda: only Beranda is stored, and opening KHS brings its data', async () => {
    const f = await at('beranda');
    const before = (await f.storeKeys({ user: 1, prefix: 'neosia:' })).keys;
    expect(before).toContain('neosia:snap:dashboard');
    expect(before).not.toContain('neosia:snap:getTranskripMahasiswa');
    expect((await f.open({ page: 'khs', close: 'x' })).result).toBe('signed_in');
    expect((await f.storeKeys({ user: 1, prefix: 'neosia:' })).keys).toContain('neosia:snap:getTranskripMahasiswa');
  });
  it('new: a page needs NEOSIA login first; after signing in it stores', async () => {
    const f = await at('new');
    expect((await f.storeKeys({ user: 1, prefix: 'neosia:' })).keys).toEqual([]);
    expect((await f.open({ page: 'home', close: 'x' })).result).toBe('needs_login');
    expect((await f.open({ page: 'login', close: 'x' })).result).toBe('signed_in');
    await f.open({ page: 'home', close: 'x' });
    expect((await f.storeKeys({ user: 1, prefix: 'neosia:' })).keys).toContain('neosia:snap:belanja_krs');
  });
  it('expired and unsupported answer as the phone would', async () => {
    expect((await (await at('expired')).open({ page: 'khs', close: 'x' })).result).toBe('needs_login');
    expect(await (await at('unsupported')).support()).toMatchObject({ docStart: false, listener: false });
  });
  it('wipe empties one account', async () => {
    const f = await at('all');
    await f.wipe({ user: 1 });
    expect((await f.storeKeys({ user: 1, prefix: 'neosia:' })).keys).toEqual([]);
  });
});
