import { describe, expect, it } from 'vitest';
import { buildCalendar, expandWeeks, type Overrides } from '@sulo/core/calendar/build';
import { categorize, jenjangOf, semesterOf, slug } from '@sulo/core/calendar/categorize';
import { addDays, daysBetween } from '@sulo/core/calendar/dates';
import { parseIcsEvents } from '@sulo/core/calendar/ics-parse';
import { bundledCalendar } from '@sulo/core/calendar/remote';
import { calendarFileSchema, kegiatanSchema, pekanSemesterSchema, type CalendarFile } from '@sulo/core/calendar/schema';
import { calendarStatus, shouldAccept } from '@sulo/core/calendar/status';
import { nextImportant, upcomingList } from '@sulo/core/calendar/upcoming';
import { weekOf } from '@sulo/core/calendar/weeks';

const cal = bundledCalendar();
const byTitle = (judul: string, mulai?: string) => cal.kegiatan.filter((k) => k.judul === judul && (mulai === undefined || k.mulai === mulai));
const range = (judul: string, mulai?: string) => byTitle(judul, mulai).map((k) => [k.mulai, k.selesai]);

describe('golden: the bundled 2026/2027 data matches the verified dates (docs/KALENDER-AKADEMIK.md)', () => {
  it('names its source', () => {
    expect(cal.tahun_ajaran).toBe('2026/2027');
    expect(cal.sumber.sk).toContain('08429/UN4.1/KEP/2026');
    expect(cal.sumber.pdf_sha256).toBe('e778ecddb0833418d2a0547f0872fca09d6ed1ef4676880175904aea6bd8155b');
    expect(cal.berlaku_sampai).toBe('2027-06-30');
    expect(cal.kegiatan).toHaveLength(62);
    expect(cal.libur_nasional).toHaveLength(18);
  });

  it('semester awal (odd)', () => {
    expect(range('Pengisian KRS daring Semester Awal')).toEqual([['2026-07-20', '2026-08-14']]);
    expect(range('Pembayaran UKT Semester Awal')).toEqual([['2026-07-13', '2026-08-07']]);
    expect(range('Kuliah perdana Semester Awal untuk semua jenjang')).toEqual([['2026-08-18', '2026-08-18']]);
    expect(range('Ujian tengah semester (UTS)', '2026-10-05')).toEqual([['2026-10-05', '2026-10-09']]);
    expect(range('Ujian final (UAS)', '2026-11-30')).toEqual([['2026-11-30', '2026-12-05']]);
    expect(range('Akhir perkuliahan Semester Awal')).toEqual([['2026-12-04', '2026-12-04']]);
    expect(range('Batas akhir pengunduran diri dari semua mata kuliah', '2026-11-06')).toEqual([['2026-11-06', '2026-11-06']]);
    expect(range('Penginputan perubahan nilai Semester Awal')).toEqual([['2026-12-21', '2026-12-27']]);
  });

  it('semester akhir (even)', () => {
    expect(range('Pengisian KRS daring Semester Akhir')).toEqual([['2027-01-03', '2027-02-12']]);
    expect(range('Pembayaran UKT Semester Akhir')).toEqual([['2027-01-02', '2027-02-05']]);
    expect(range('Ujian tengah semester (UTS)', '2027-04-05')).toEqual([['2027-04-05', '2027-04-10']]);
    expect(range('Ujian final (UAS)', '2027-06-14')).toEqual([['2027-06-14', '2027-06-18']]);
    expect(range('Akhir perkuliahan Semester Akhir')).toEqual([['2027-06-25', '2027-06-25']]);
  });

  it('corrections from the PDF', () => {
    const libur = cal.kegiatan.filter((k) => k.kategori === 'libur').map((k) => [k.id, k.mulai, k.selesai, k.ujung_terbuka]);
    expect(libur).toEqual([
      ['2026-2027-libur-semester-sebelum-awal', '2026-06-29', '2026-08-15', false],
      ['2026-2027-libur-semester-setelah-awal', '2026-12-07', '2027-02-13', false],
      ['2026-2027-libur-semester-setelah-akhir', '2027-06-28', null, true],
    ]);
    const oktober = byTitle('Wisuda Oktober 2026')[0]!;
    expect([oktober.mulai, oktober.selesai]).toEqual(['2026-10-27', '2026-10-29']);
    expect(oktober.nilai_lain).toMatchObject([{ mulai: '2026-10-26', selesai: '2026-10-27' }]);
    expect(range('Dies Natalis Unhas')).toEqual([['2026-09-10', '2026-09-10']]);
    const idulFitri = cal.libur_nasional.find((l) => l.nama.startsWith('Hari Raya Idul Fitri'))!;
    expect([idulFitri.mulai, idulFitri.selesai]).toEqual(['2027-03-10', '2027-03-11']);
    expect(idulFitri.catatan).toContain('dua kali');
  });

  it('nine graduation periods', () => {
    expect(cal.kegiatan.filter((k) => k.kategori === 'wisuda').map((k) => `${k.mulai}/${k.selesai}`)).toEqual([
      '2026-06-22/2026-06-23', '2026-07-28/2026-07-30', '2026-09-01/2026-09-03', '2026-10-27/2026-10-29', '2026-12-15/2026-12-17',
      '2027-02-02/2027-02-04', '2027-03-30/2027-04-01', '2027-05-11/2027-05-13', '2027-06-22/2027-06-24',
    ]);
  });

  it('national holidays start as "cocok_pdf" until checked against the SKB', () => {
    expect(new Set(cal.libur_nasional.map((l) => l.status_verifikasi))).toEqual(new Set(['cocok_pdf']));
  });

  it('study evaluations carry the PDF details; unclear ones are flagged', () => {
    const evals = cal.kegiatan.filter((k) => k.kategori === 'evaluasi');
    expect(evals.map((k) => [k.mulai, k.status_verifikasi, k.rincian.length > 0])).toEqual([
      ['2026-07-17', 'perlu_cek', true],
      ['2026-07-24', 'cocok_ics_pdf', true],
      ['2026-12-31', 'perlu_cek', true],
      ['2027-01-22', 'perlu_cek', true],
    ]);
  });

  it('admissions are for applicants (hidden by default)', () => {
    const applicants = cal.kegiatan.filter((k) => k.audiens === 'calon_mahasiswa');
    expect(applicants).toHaveLength(13);
    expect(applicants.every((k) => k.kategori === 'penerimaan')).toBe(true);
  });

  it('teaching weeks: 16 from Monday 17 Aug 2026, UTS week 8, UAS week 16; even semester not available', () => {
    const awal = cal.pekan.awal!;
    expect(awal.pekan[0]).toEqual({ nomor: 1, mulai: '2026-08-17' });
    expect(awal.pekan[15]).toEqual({ nomor: 16, mulai: '2026-11-30' });
    expect([awal.uts_pekan, awal.uas_pekan]).toEqual([8, 16]);
    expect(weekOf(awal, '2026-10-05')).toMatchObject({ nomor: 8, uts: true });
    expect(weekOf(awal, '2026-11-30')).toMatchObject({ nomor: 16, uas: true });
    expect(cal.pekan.akhir).toBeNull();
  });

  it('every id is stable-looking and unique', () => {
    const ids = [...cal.kegiatan, ...cal.libur_nasional].map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith('2026-2027-'))).toBe(true);
  });
});

describe('schema', () => {
  const base = cal.kegiatan[0]!;
  it('accepts the bundled file', () => {
    expect(calendarFileSchema.safeParse(cal).success).toBe(true);
  });
  it('rejects an end before the start, a null end without ujung_terbuka, and an open end with a date', () => {
    expect(kegiatanSchema.safeParse({ ...base, mulai: '2026-08-02', selesai: '2026-08-01' }).success).toBe(false);
    expect(kegiatanSchema.safeParse({ ...base, selesai: null, ujung_terbuka: false }).success).toBe(false);
    expect(kegiatanSchema.safeParse({ ...base, ujung_terbuka: true }).success).toBe(false);
  });
  it('rejects duplicate ids and weeks that do not start on Monday or skip a number', () => {
    expect(calendarFileSchema.safeParse({ ...cal, kegiatan: [base, base] }).success).toBe(false);
    expect(pekanSemesterSchema.safeParse({ pekan: [{ nomor: 1, mulai: '2026-08-18' }], uts_pekan: null, uas_pekan: null }).success).toBe(false);
    expect(pekanSemesterSchema.safeParse({ pekan: [{ nomor: 2, mulai: '2026-08-17' }], uts_pekan: null, uas_pekan: null }).success).toBe(false);
  });
  it('rejects unknown categories and bad dates', () => {
    expect(kegiatanSchema.safeParse({ ...base, kategori: 'pesta' }).success).toBe(false);
    expect(kegiatanSchema.safeParse({ ...base, mulai: '17 Agu 2026' }).success).toBe(false);
  });
});

describe('ICS conversion', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'UID:contoh-9@example.test',
    'DTSTART;VALUE=DATE:20261005',
    'DTEND;VALUE=DATE:20261010',
    'SUMMARY:Ujian tengah semester (UTS)',
    'DESCRIPTION:https://www.unhas.ac.id/kalender-akademik/?lang=id',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20270301',
    'DTEND;VALUE=DATE:20270601',
    'SUMMARY:Sarjana jalur UTBK-SNBT 2027/2028\\, gelom',
    ' bang 2',
    'DESCRIPTION:perkiraan bulan. https://www.unhas.ac.id',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  it('reads all-day events with inclusive ends, unfolds and unescapes', () => {
    expect(parseIcsEvents(ics)).toEqual([
      { summary: 'Ujian tengah semester (UTS)', description: 'https://www.unhas.ac.id/kalender-akademik/?lang=id', mulai: '2026-10-05', selesai: '2026-10-09', perkiraan: false },
      { summary: 'Sarjana jalur UTBK-SNBT 2027/2028, gelombang 2', description: 'perkiraan bulan. https://www.unhas.ac.id', mulai: '2027-03-01', selesai: '2027-05-31', perkiraan: true },
    ]);
  });

  it('category rules, in order', () => {
    const cases: [string, string, string][] = [
      ['Mahasiswa yang memiliki surat izin ujian atau surat pendaftaran wisuda tidak dikenakan UKT Semester Awal', 'administrasi', 'mahasiswa'],
      ['Wisuda Oktober 2026', 'wisuda', 'mahasiswa'],
      ['Sarjana jalur SNBP 2027/2028', 'penerimaan', 'calon_mahasiswa'],
      ['Prosesi penerimaan mahasiswa baru S1/D4', 'penerimaan', 'calon_mahasiswa'],
      ['Ujian tengah semester (UTS)', 'uts', 'mahasiswa'],
      ['Ujian final (UAS)', 'uas', 'mahasiswa'],
      ['Pengisian KRS daring Semester Akhir', 'krs', 'mahasiswa'],
      ['Batas akhir penginputan nilai daring Semester Awal', 'nilai', 'mahasiswa'],
      ['Batas akhir masa studi bagi angkatan yang dievaluasi (rincian di PDF)', 'evaluasi', 'mahasiswa'],
      ['Kuliah Kerja Nyata (KKN) Reguler', 'kkn', 'mahasiswa'],
      ['Libur semester', 'libur', 'mahasiswa'],
      ['Penginputan jadwal kuliah Semester Awal ke NeoSIA', 'jadwal', 'mahasiswa'],
      ['Kuliah perdana Semester Awal untuk semua jenjang', 'perkuliahan', 'mahasiswa'],
      ['Batas akhir pembatalan/penggantian mata kuliah', 'administrasi', 'mahasiswa'],
      ['Pembayaran UKT Semester Awal', 'administrasi', 'mahasiswa'],
      ['Sesuatu yang baru', 'lainnya', 'mahasiswa'],
    ];
    for (const [judul, kategori, audiens] of cases) expect([judul, categorize(judul)]).toEqual([judul, { kategori, audiens }]);
  });

  it('levels, without reading "Pascasarjana" as S1', () => {
    expect(jenjangOf('Kuliah perdana Semester Awal untuk semua jenjang')).toEqual(['semua']);
    expect(jenjangOf('Prosesi penerimaan mahasiswa baru S1/D4')).toEqual(['S1', 'D4']);
    expect(jenjangOf('Prosesi penerimaan mahasiswa baru S3, S2, spesialis, dan profesi oleh fakultas/Sekolah Pascasarjana')).toEqual(['S2', 'S3', 'profesi', 'spesialis']);
    expect(jenjangOf('Sarjana dan sarjana terapan jalur mandiri SMK Berprestasi 2027/2028')).toEqual(['S1', 'D4']);
    expect(jenjangOf('Ujian final (UAS)')).toEqual(['semua']);
  });

  it('semester from the title, the date, or none for another academic year', () => {
    expect(semesterOf('Pengisian KRS daring Semester Akhir', '2027-01-03', '2026-12-05', '2026/2027')).toBe('akhir');
    expect(semesterOf('Ujian final (UAS)', '2026-11-30', '2026-12-05', '2026/2027')).toBe('awal');
    expect(semesterOf('Libur semester', '2026-12-07', '2026-12-05', '2026/2027')).toBe('akhir');
    expect(semesterOf('Akhir perkuliahan Semester Akhir T.A. 2025/2026', '2026-06-26', '2026-12-05', '2026/2027')).toBeNull();
    expect(semesterOf('Sarjana jalur SNBP 2027/2028', '2027-01-01', '2026-12-05', '2026/2027')).toBeNull();
    expect(slug('Ujian tengah semester (UTS)')).toBe('ujian-tengah-semester');
  });

  it('an override that matches no ICS event stops the build', () => {
    const o = {
      tahun_ajaran: '2026/2027',
      semester_akhir_mulai: '2026-12-05',
      ubah: [{ judul_ics: 'Tidak ada', mulai_ics: '2026-01-01', alasan: '', set: {} }],
      tambah: [],
      libur_nasional: [],
      pekan: { awal: null, akhir: null },
    } as unknown as Overrides;
    expect(() => buildCalendar(parseIcsEvents(ics), o)).toThrow(/tidak menemukan/);
  });

  it('expands a week spec into an explicit list, skipping excluded weeks', () => {
    const p = expandWeeks({ mulai_pekan_1: '2027-02-15', jumlah: 3, uts_pekan: null, uas_pekan: null, dikecualikan: [{ mulai: '2027-02-22', alasan: 'Libur' }] });
    expect(p.pekan).toEqual([{ nomor: 1, mulai: '2027-02-15' }, { nomor: 2, mulai: '2027-03-01' }, { nomor: 3, mulai: '2027-03-08' }]);
    expect(weekOf(p, '2027-02-24')).toEqual({ kind: 'excluded', alasan: 'Libur' });
  });
});

describe('week N', () => {
  const awal = cal.pekan.awal!;
  it('"belum tersedia" when the semester has no list', () => {
    expect(weekOf(cal.pekan.akhir, '2027-03-01')).toEqual({ kind: 'unavailable' });
  });
  it('before the first and after the last week', () => {
    expect(weekOf(awal, '2026-08-16')).toEqual({ kind: 'before', startsOn: '2026-08-17' });
    expect(weekOf(awal, '2026-12-07')).toEqual({ kind: 'after' });
  });
  it('property: every day of the 16 weeks maps to floor(days / 7) + 1', () => {
    for (let i = 0; i < 16 * 7; i++) {
      const day = addDays('2026-08-17', i);
      expect(weekOf(awal, day)).toMatchObject({ kind: 'week', nomor: Math.floor(i / 7) + 1, total: 16 });
    }
  });
});

describe('next important date', () => {
  it('counts down to UAS in mid November (estimates and applicant events left out)', () => {
    expect(nextImportant(cal, '2026-11-16')).toMatchObject({ status: 'akan_datang', hariLagi: 14, kegiatan: { kategori: 'uas' } });
  });
  it('ongoing windows come first, the one ending soonest on top (UKT, then KRS of the even semester)', () => {
    const list = upcomingList(cal, '2027-01-10').slice(0, 3);
    expect(list.map((i) => [i.status, i.kegiatan.kategori, i.kegiatan.selesai])).toEqual([
      ['berlangsung', 'administrasi', '2027-02-05'],
      ['berlangsung', 'krs', '2027-02-12'],
      ['berlangsung', 'libur', '2027-02-13'],
    ]);
  });
  it('an open-ended break is still "ongoing" after the calendar ends, and nothing else is left', () => {
    expect(nextImportant(cal, '2027-07-10')).toMatchObject({ status: 'berlangsung', kegiatan: { id: '2026-2027-libur-semester-setelah-akhir' } });
  });
  it('counts whole days', () => {
    expect(daysBetween('2026-11-16', '2026-11-30')).toBe(14);
  });
});

describe('which file to trust, and when it is out of date', () => {
  const next = (patch: Partial<CalendarFile>): CalendarFile => ({ ...cal, ...patch });
  it('accepts a newer academic year, or the same year with a higher revision', () => {
    expect(shouldAccept(null, cal)).toBe(true);
    expect(shouldAccept(cal, next({ revisi: 2 }))).toBe(true);
    expect(shouldAccept(cal, next({ revisi: 1 }))).toBe(false);
    expect(shouldAccept(next({ revisi: 3 }), next({ revisi: 2 }))).toBe(false);
    expect(shouldAccept(cal, next({ tahun_ajaran: '2027/2028', revisi: 1 }))).toBe(true);
    expect(shouldAccept(next({ tahun_ajaran: '2027/2028' }), next({ revisi: 9 }))).toBe(false);
  });
  it('is out of date after 30 Jun 2027 without next year\'s data', () => {
    expect(calendarStatus(cal, '2027-06-30')).toEqual({ kind: 'ok', berlakuSampai: '2027-06-30' });
    expect(calendarStatus(cal, '2027-07-01')).toEqual({ kind: 'expired', berlakuSampai: '2027-06-30' });
    expect(calendarStatus(null, '2027-07-01')).toEqual({ kind: 'missing' });
  });
});
