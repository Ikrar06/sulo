// The MKPK courses (Mata Kuliah Penguatan Kompetensi, Kurikulum 2023), from
// the official rubric, Rubrik Penilaian MKPK, 3rd edition, table 2.1. Pure
// data. Unhas writes that the codes in the KRS "may be updated", so a code
// of the same shape that is not listed here still counts as MKPK
// (mkpkCourse), with its credits read from the code itself.
//
// Shape of a Kurikulum 2023 course code, seen in NEOSIA (26 Nov 2026):
// "23" the curriculum, one letter (the faculty; "U" for university-wide
// courses), two digits for the unit ("02" is MKPK, "03" is KKN), four more
// digits, and the last two digits are the credits.

export interface MkpkCourse {
  code: string;
  name: string;
  sks: number;
}

export const MKPK_COURSES: readonly MkpkCourse[] = [
  { code: '23U02130102', name: 'Komunikasi dan Kerjasama', sks: 2 },
  { code: '23U02130202', name: 'Manajemen Kegiatan', sks: 2 },
  { code: '23U02130302', name: 'Strategi Negosiasi', sks: 2 },
  { code: '23U02130402', name: 'Pembelajaran Aktif', sks: 2 },
  { code: '23U02130502', name: 'Komunikasi Digital', sks: 2 },
  { code: '23U02130602', name: 'Empati Sosial', sks: 2 },
  { code: '23U02130702', name: 'Keberagaman Budaya', sks: 2 },
  { code: '23U02130802', name: 'Pengembangan Masyarakat', sks: 2 },
  { code: '23U02130902', name: 'Kewirausahaan Rintisan', sks: 2 },
  { code: '23U02131004', name: 'Kewirausahaan Rintisan', sks: 4 },
  { code: '23U02131102', name: 'Kepemimpinan Inovatif', sks: 2 },
  { code: '23U02131202', name: 'Pengambilan Keputusan', sks: 2 },
  { code: '23U02131302', name: 'Pemecahan Masalah', sks: 2 },
  { code: '23U02131402', name: 'Etika Profesi', sks: 2 },
  { code: '23U02131502', name: 'Berfikir Kritis dan Kreatif', sks: 2 },
  { code: '23U02131602', name: 'Kreativitas Solutif', sks: 2 },
  { code: '23U02131702', name: 'Inovasi dan Pemikiran Desain', sks: 2 },
  { code: '23U02131801', name: 'Pengembangan Talenta', sks: 1 },
  { code: '23U02131902', name: 'Pengembangan Talenta', sks: 2 },
  { code: '23U02132002', name: 'Literasi dan Presentasi Ilmiah', sks: 2 },
  { code: '23U02132102', name: 'Magang/Praktek Kerja', sks: 2 },
  { code: '23U02132203', name: 'Magang/Praktek Kerja', sks: 3 },
  { code: '23U02132304', name: 'Magang/Praktek Kerja', sks: 4 },
  { code: '23U02132406', name: 'Magang/Praktek Kerja', sks: 6 },
  { code: '23U02132509', name: 'Magang/Praktek Kerja', sks: 9 },
  { code: '23U02132602', name: 'Studi/Proyek Independen', sks: 2 },
  { code: '23U02132704', name: 'Studi/Proyek Independen', sks: 4 },
  { code: '23U02132806', name: 'Studi/Proyek Independen', sks: 6 },
  { code: '23U02133020', name: 'Riset Mandiri', sks: 20 },
  { code: '23U02133120', name: 'Pengembangan Kreativitas dan Inovasi', sks: 20 },
  { code: '23U02133220', name: 'Kepemimpinan dan Karakter Bela Negara', sks: 20 },
  { code: '23U02133320', name: 'Kemaslahatan Benua Maritim Indonesia (BMI)', sks: 20 },
  { code: '23U02133420', name: 'Pengembangan dan Penguatan Kewirausahaan', sks: 20 },
  { code: '23U02133520', name: 'Praktek Dunia Usaha/Dunia Industri', sks: 20 },
  { code: '23U02133620', name: 'Pengembangan Karakter Humanis', sks: 20 },
  { code: '23U02133720', name: 'Komunikasi dan Interaksi Sosial', sks: 20 },
];

const BY_CODE: ReadonlyMap<string, MkpkCourse> = new Map(MKPK_COURSES.map((c) => [c.code, c]));

/** A Kurikulum 2023 (or later) course code: two digits, a letter, eight digits. */
export const COURSE_CODE = /^(\d{2})([A-Z])(\d{8})$/;
/** An MKPK code: university-wide ("U"), unit 02. */
const MKPK_CODE = /^\d{2}U02\d{6}$/;

const normal = (code: string | null | undefined): string | null => {
  const c = (code ?? '').trim().toUpperCase();
  return c === '' ? null : c;
};

/** Credits written in a course code's last two digits, or null for another shape. */
export function sksFromCode(code: string | null | undefined): number | null {
  const c = normal(code);
  if (!c || !COURSE_CODE.test(c)) return null;
  const sks = Number(c.slice(-2));
  return sks > 0 ? sks : null;
}

/**
 * The MKPK course for a code: from the rubric's list, or (an unlisted code
 * of the MKPK shape) a course whose name the caller supplies and whose
 * credits come from the code. Null when the code is not MKPK.
 */
export function mkpkCourse(code: string | null | undefined, fallbackName: string | null = null): (MkpkCourse & { listed: boolean }) | null {
  const c = normal(code);
  if (!c) return null;
  const listed = BY_CODE.get(c);
  if (listed) return { ...listed, listed: true };
  if (!MKPK_CODE.test(c)) return null;
  const sks = sksFromCode(c);
  return sks === null ? null : { code: c, name: fallbackName?.trim() || c, sks, listed: false };
}

/** The faculty letter of a course code ("D" for 23D12130902), or null; "U" (university-wide) included. */
export function facultyLetter(code: string | null | undefined): string | null {
  const m = COURSE_CODE.exec(normal(code) ?? '');
  return m ? m[2]! : null;
}

/** True for a code of Kurikulum 2023 or later, the curricula that have MKPK. */
export function isK23Code(code: string | null | undefined): boolean {
  const m = COURSE_CODE.exec(normal(code) ?? '');
  return m !== null && Number(m[1]) >= 23 && Number(m[1]) < 90;
}
