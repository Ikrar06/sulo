import { describe, expect, it } from 'vitest';
import { facultyLetter, isK23Code, MKPK_COURSES, mkpkCourse, sksFromCode } from '@sulo/core/mkpk/codes';
import { estimateLoad, parseLoadChoice } from '@sulo/core/mkpk/load';
import { mkpkProgress } from '@sulo/core/mkpk/progress';
import { MKPK_TRANSCRIPT_KEY, readMkpkTranscript, summarizeTranscript } from '@sulo/core/mkpk/transcript';
import { CAPTURE_SCHEMA_VERSION } from '@sulo/core/neosia/allowlist';
import { NEOSIA_MODULE_KEY } from '@sulo/core/neosia/module';
import { ingestCapture, snapshotKey, type Snapshots } from '@sulo/core/neosia/store';
import { DEFAULT_PREFS, readPrefs } from '@sulo/core/prefs';
import { memoryStore } from './helpers';

// Synthetic transcript rows: invented courses of an invented engineering student.
const row = (kode: string, nama: string, sks: number, nilai: string | null, extra: Record<string, unknown> = {}) => ({
  kode_mata_kuliah: kode,
  nama_mata_kuliah: nama,
  sks,
  nilai_huruf: nilai,
  id_semester: 101,
  is_used: true,
  ...extra,
});
const TRANSCRIPT = {
  transkrip: [
    row('23D12110103', 'Kalkulus Sintetis', 3, 'B'),
    row('23D12110203', 'Fisika Sintetis', 3, 'A'),
    row('23D12120102', 'Logika Sintetis', 2, 'A-'),
    row('23U01110102', 'Agama Sintetis', 2, 'A'),
    row('23U02130202', 'Manajemen Kegiatan', 2, 'A'),
    row('23U02131102', 'Kepemimpinan Inovatif', 2, 'B+'),
    // Failed, pending and withdrawn MKPK courses do not count.
    row('23U02130302', 'Strategi Negosiasi', 2, 'E'),
    row('23U02130402', 'Pembelajaran Aktif', 2, 'T'),
    row('23U02130502', 'Komunikasi Digital', 2, null),
    // An older attempt NEOSIA marks as not used.
    row('23U02130602', 'Empati Sosial', 2, 'B', { is_used: false }),
    // KKN is university-wide but not MKPK.
    row('23U03130104', 'Kuliah Kerja Nyata', 4, 'A'),
  ],
};

const kelas = (kode: string, nama: string, sks: number, extra: Record<string, unknown> = {}) => ({ nama: 'A', is_batal: false, sks, mata_kuliah: { kode, nama_resmi: nama }, jadwal_kuliahs: [], dosens: [], ...extra });
const snap = (endpoint: keyof Snapshots, data: unknown, seenAt = 1_794_000_000) => ({ endpoint, v: CAPTURE_SCHEMA_VERSION, data, changedAt: seenAt, seenAt, unknownShapeAt: null });

describe('MKPK codes', () => {
  it('lists the 36 courses of the rubric, with the credits written in each code', () => {
    expect(MKPK_COURSES).toHaveLength(36);
    expect(new Set(MKPK_COURSES.map((c) => c.code)).size).toBe(36);
    expect(MKPK_COURSES.filter((c) => c.sks === 20)).toHaveLength(8);
    for (const c of MKPK_COURSES) expect(sksFromCode(c.code)).toBe(c.sks);
  });

  it('recognises listed codes, unlisted codes of the MKPK shape, and nothing else', () => {
    expect(mkpkCourse('23U02130202')).toMatchObject({ name: 'Manajemen Kegiatan', sks: 2, listed: true });
    expect(mkpkCourse(' 23u02139904 ', 'Mata Kuliah Baru')).toMatchObject({ code: '23U02139904', name: 'Mata Kuliah Baru', sks: 4, listed: false });
    expect(mkpkCourse('23U03130104')).toBeNull();
    expect(mkpkCourse('23D12130902')).toBeNull();
    expect(mkpkCourse('ABC')).toBeNull();
    expect(mkpkCourse(null)).toBeNull();
  });

  it('reads the faculty letter and the curriculum from a code', () => {
    expect(facultyLetter('23D12130902')).toBe('D');
    expect(facultyLetter('23U02130102')).toBe('U');
    expect(facultyLetter('KODE-LAMA')).toBeNull();
    expect(isK23Code('23D12130902')).toBe(true);
    expect(isK23Code('25D12130902')).toBe(true);
    expect(isK23Code('18D12130902')).toBe(false);
  });
});

describe('transcript summary', () => {
  it('keeps passed MKPK courses with their credits, and never a grade or another course name', () => {
    const summary = summarizeTranscript(TRANSCRIPT as never, 100)!;
    expect(summary.passed).toEqual([
      { code: '23U02130202', name: 'Manajemen Kegiatan', sks: 2 },
      { code: '23U02131102', name: 'Kepemimpinan Inovatif', sks: 2 },
    ]);
    expect(summary.letters).toEqual({ D: 3 });
    expect(summary.k23).toBe(true);
    const text = JSON.stringify(summary);
    for (const leak of ['Kalkulus', 'Fisika', '"A"', '"B+"', 'nilai']) expect(text).not.toContain(leak);
  });

  it('is null without a transcript list', () => {
    expect(summarizeTranscript({ other: 1 } as never, 1)).toBeNull();
    expect(summarizeTranscript(null, 1)).toBeNull();
  });

  it('is written when a transcript capture is stored, and made once from an older capture', async () => {
    const store = memoryStore({ [NEOSIA_MODULE_KEY]: { enabled: true, changedAt: 1 } });
    const result = await ingestCapture(store, 500, { type: 'sulo:capture:v1', endpoint: 'getTranskripMahasiswa', status: 'ok', v: CAPTURE_SCHEMA_VERSION, data: TRANSCRIPT, at: 1 });
    expect(result.kind).toBe('stored');
    expect(store.dump()[MKPK_TRANSCRIPT_KEY]).toMatchObject({ at: 500, passed: [{ code: '23U02130202' }, { code: '23U02131102' }] });

    const older = memoryStore({ [snapshotKey('getTranskripMahasiswa')]: snap('getTranskripMahasiswa', TRANSCRIPT, 42) });
    const read = await readMkpkTranscript(older, snapshotKey('getTranskripMahasiswa'));
    expect(read?.at).toBe(42);
    expect(older.dump()[MKPK_TRANSCRIPT_KEY]).toEqual(read);
    expect(await readMkpkTranscript(memoryStore(), snapshotKey('getTranskripMahasiswa'))).toBeNull();
  });
});

describe('MKPK progress', () => {
  const transcript = summarizeTranscript(TRANSCRIPT as never, 100);
  const krs = {
    kartu_rencana_studi: {
      kelas_kuliahs: [
        kelas('23D12130902', 'Bisnis Sintetis', 2),
        kelas('23U02132304', 'Magang/Praktek Kerja', 4),
        // Cancelled, and already passed: neither counts as enrolled.
        kelas('23U02131302', 'Pemecahan Masalah', 2, { is_batal: true }),
        kelas('23U02130202', 'Manajemen Kegiatan', 2),
      ],
    },
  };
  const offered = {
    semesters: {
      6: [kelas('23U02131202', 'Pengambilan Keputusan', 2), kelas('23U02131202', 'Pengambilan Keputusan', 2, { nama: 'INTER' }), kelas('23D12131202', 'Grafika Sintetis', 2)],
      7: [kelas('23U02132304', 'Magang/Praktek Kerja', 4), kelas('23U02130202', 'Manajemen Kegiatan', 2), kelas('23U02131801', 'Pengembangan Talenta', 1)],
    },
  };

  it('adds up passed and enrolled credits and lists what is on offer, once per course', () => {
    const p = mkpkProgress({ belanja_krs: snap('belanja_krs', krs, 77), kelas_kuliah_tersedia: snap('kelas_kuliah_tersedia', offered) } as Snapshots, transcript);
    expect(p.applies).toBe(true);
    expect(p.passedSks).toBe(4);
    expect(p.enrolled).toEqual([{ code: '23U02132304', name: 'Magang/Praktek Kerja', sks: 4 }]);
    expect(p.enrolledSks).toBe(4);
    expect(p.offered.map((o) => o.code)).toEqual(['23U02131202', '23U02131801']);
    expect(p.transcriptAt).toBe(100);
    expect(p.krsAt).toBe(77);
  });

  it('does not apply to a student without Kurikulum 2023 codes or MKPK courses', () => {
    // A course code of an older curriculum (2018).
    const old = summarizeTranscript({ transkrip: [row('18D12110103', 'Lama', 3, 'A')] } as never, 1);
    expect(mkpkProgress({}, old).applies).toBe(false);
    expect(mkpkProgress({}, null)).toMatchObject({ applies: false, passedSks: 0, enrolledSks: 0, transcriptAt: null, krsAt: null });
  });

  it('applies from the KRS alone, before the transcript was ever opened', () => {
    expect(mkpkProgress({ belanja_krs: snap('belanja_krs', krs) } as Snapshots, null).applies).toBe(true);
  });
});

describe('MKPK load', () => {
  it('estimates from the most frequent faculty letter', () => {
    expect(estimateLoad({ D: 30, H: 2 })).toBe(20);
    expect(estimateLoad({ C: 40 })).toBe(10);
    expect(estimateLoad({ R: 5, D: 1 })).toBe(10);
  });

  it('gives no estimate for too few codes, a tie, or a faculty whose cluster is not known', () => {
    expect(estimateLoad({ D: 2 })).toBeNull();
    expect(estimateLoad({ D: 5, C: 5 })).toBeNull();
    expect(estimateLoad({ O: 20 })).toBeNull();
    expect(estimateLoad({ Q: 20 })).toBeNull();
    expect(estimateLoad({ Z: 20 })).toBeNull();
    expect(estimateLoad({})).toBeNull();
    expect(estimateLoad({ U: 40 })).toBeNull();
  });

  it('stores only a confirmed choice, read defensively', async () => {
    expect(parseLoadChoice(20)).toBe(20);
    expect(parseLoadChoice('none')).toBe('none');
    expect(parseLoadChoice(15)).toBeNull();
    expect(DEFAULT_PREFS.mkpkLoad).toBeNull();
    expect((await readPrefs(memoryStore({ 'global:prefs': { mkpkLoad: 12 } }))).mkpkLoad).toBeNull();
    expect((await readPrefs(memoryStore({ 'global:prefs': { mkpkLoad: 10 } }))).mkpkLoad).toBe(10);
  });
});
