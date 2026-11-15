// Keyword rules from an ICS title to category, audience and level. Explicit,
// ordered and tested (tests/calendar-convert.test.ts): the first rule that
// matches wins. Titles are Indonesian, as published by Unhas.

import type { Audiens, Jenjang, Kategori, Semester } from './schema.ts';

interface Rule {
  test: RegExp;
  kategori: Kategori;
  audiens?: Audiens;
}

/** Order matters: "surat pendaftaran wisuda tidak dikenakan UKT" is administration, not graduation. */
export const CATEGORY_RULES: readonly Rule[] = [
  { test: /tidak dikenakan ukt/i, kategori: 'administrasi' },
  { test: /\bjalur\b|masuk semester|prosesi penerimaan|penerimaan mahasiswa baru/i, kategori: 'penerimaan', audiens: 'calon_mahasiswa' },
  { test: /wisuda/i, kategori: 'wisuda' },
  { test: /ujian tengah semester|\buts\b/i, kategori: 'uts' },
  { test: /ujian final|ujian akhir semester|\buas\b/i, kategori: 'uas' },
  { test: /\bkrs\b/i, kategori: 'krs' },
  { test: /sanggah/i, kategori: 'sanggah' },
  { test: /\bnilai\b/i, kategori: 'nilai' },
  { test: /evaluasi|masa studi/i, kategori: 'evaluasi' },
  { test: /\bkkn\b|kuliah kerja nyata/i, kategori: 'kkn' },
  { test: /\blibur\b/i, kategori: 'libur' },
  { test: /jadwal kuliah/i, kategori: 'jadwal' },
  { test: /kuliah perdana|akhir perkuliahan/i, kategori: 'perkuliahan' },
  { test: /\bukt\b|cuti akademik|pembatalan|penggantian mata kuliah|pengunduran diri/i, kategori: 'administrasi' },
];

export function categorize(judul: string): { kategori: Kategori; audiens: Audiens } {
  const rule = CATEGORY_RULES.find((r) => r.test.test(judul));
  return { kategori: rule?.kategori ?? 'lainnya', audiens: rule?.audiens ?? 'mahasiswa' };
}

/** Levels named in the title; none named means everyone. */
export function jenjangOf(judul: string): Jenjang[] {
  if (/semua jenjang/i.test(judul)) return ['semua'];
  const found: Jenjang[] = [];
  // "Pascasarjana" (graduate school) is not "sarjana".
  if (/\bS1\b|(?:^|[^a-z])sarjana(?! terapan)/i.test(judul)) found.push('S1');
  if (/\bD4\b|sarjana terapan/i.test(judul)) found.push('D4');
  if (/\bS2\b|magister/i.test(judul)) found.push('S2');
  if (/\bS3\b|doktor/i.test(judul)) found.push('S3');
  if (/profesi/i.test(judul)) found.push('profesi');
  if (/spesialis/i.test(judul)) found.push('spesialis');
  return found.length > 0 ? found : ['semua'];
}

/**
 * Semester of the academic year: named in the title, otherwise by date
 * (from `akhirMulai` on = "akhir"). A title that names another academic year
 * (T.A. 2025/2026, admissions for 2027/2028) belongs to no semester of this one.
 */
export function semesterOf(judul: string, mulai: string, akhirMulai: string, tahunAjaran: string): Semester | null {
  const years = judul.match(/\d{4}\/\d{4}/g) ?? [];
  if (years.some((y) => y !== tahunAjaran)) return null;
  if (/semester awal/i.test(judul)) return 'awal';
  if (/semester akhir/i.test(judul)) return 'akhir';
  return mulai < akhirMulai ? 'awal' : 'akhir';
}

/** Lowercase ASCII slug for stable ids. */
export function slug(text: string, max = 48): string {
  const s = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s.length <= max ? s : s.slice(0, max).replace(/-[^-]*$/, '');
}
