// Academic calendar data (docs/KALENDER-AKADEMIK.md). One file per academic
// year, converted from the official ICS and corrected from the official PDF
// (scripts/calendar/build.ts). Field names are Indonesian, like the docs.
// Explicit .ts imports: Node runs the build script without a build step.
//
// Dates are local calendar dates (YYYY-MM-DD, Asia/Makassar), never instants.
// `selesai` is inclusive; null only with `ujung_terbuka` (no end date in the
// source). ICS output turns it into an exclusive DTEND.

import { z } from 'zod';

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

export const KATEGORI = [
  'jadwal',
  'krs',
  'perkuliahan',
  'uts',
  'uas',
  'libur',
  'nilai',
  'sanggah',
  'evaluasi',
  'kkn',
  'wisuda',
  'administrasi',
  'penerimaan',
  'lainnya',
] as const;
export type Kategori = (typeof KATEGORI)[number];

export const JENJANG = ['semua', 'S1', 'D4', 'S2', 'S3', 'profesi', 'spesialis'] as const;
export type Jenjang = (typeof JENJANG)[number];

/** Who an event is for: active students, applicants, or everyone. */
export const AUDIENS = ['mahasiswa', 'calon_mahasiswa', 'umum'] as const;
export type Audiens = (typeof AUDIENS)[number];

/**
 * How far a date was checked: against the ICS and the PDF, against the PDF
 * only, against the joint ministerial decree (SKB 3 Menteri) for holidays,
 * or flagged for a human to check.
 */
export const STATUS_VERIFIKASI = ['cocok_ics_pdf', 'cocok_pdf', 'cocok_skb', 'perlu_cek'] as const;
export type StatusVerifikasi = (typeof STATUS_VERIFIKASI)[number];

export const SEMESTER = ['awal', 'akhir'] as const;
export type Semester = (typeof SEMESTER)[number];

/** A date range from another source that disagrees with the one used. */
export const nilaiLainSchema = z.object({
  mulai: dateKey,
  selesai: dateKey.nullable(),
  sumber: z.string().min(1),
  catatan: z.string().default(''),
});

const rangeRefine = <T extends { mulai: string; selesai: string | null; ujung_terbuka?: boolean }>(v: T, ctx: z.RefinementCtx) => {
  if (v.selesai === null && !v.ujung_terbuka) ctx.addIssue({ code: 'custom', message: 'selesai null hanya dengan ujung_terbuka' });
  if (v.selesai !== null && v.ujung_terbuka) ctx.addIssue({ code: 'custom', message: 'ujung_terbuka tanpa selesai null' });
  if (v.selesai !== null && v.selesai < v.mulai) ctx.addIssue({ code: 'custom', message: 'selesai lebih awal dari mulai' });
};

export const kegiatanSchema = z
  .object({
    /** Stable across revisions; the ICS UID is `{id}@sulo`. Never derived from the Unhas UID. */
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    semester: z.enum(SEMESTER).nullable(),
    kategori: z.enum(KATEGORI),
    judul: z.string().min(1),
    mulai: dateKey,
    selesai: dateKey.nullable(),
    ujung_terbuka: z.boolean().default(false),
    /** "perkiraan bulan" in the source: only the months are known. */
    perkiraan: z.boolean().default(false),
    audiens: z.enum(AUDIENS),
    jenjang: z.array(z.enum(JENJANG)).min(1),
    status_verifikasi: z.enum(STATUS_VERIFIKASI),
    /** Where the event came from: the Unhas ICS, or added from the PDF. */
    asal: z.enum(['ics', 'pdf']),
    nilai_lain: z.array(nilaiLainSchema).default([]),
    /** Details copied word for word from the PDF (study evaluation per intake year). */
    rincian: z.array(z.string()).default([]),
    catatan: z.string().default(''),
  })
  .superRefine(rangeRefine);
export type Kegiatan = z.infer<typeof kegiatanSchema>;

export const liburSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    nama: z.string().min(1),
    mulai: dateKey,
    selesai: dateKey,
    jenis: z.enum(['libur_nasional', 'cuti_bersama']),
    status_verifikasi: z.enum(STATUS_VERIFIKASI),
    catatan: z.string().default(''),
  })
  .superRefine((v, ctx) => rangeRefine({ ...v, ujung_terbuka: false }, ctx));
export type Libur = z.infer<typeof liburSchema>;

/** Explicit teaching weeks of one semester: number and Monday, plus weeks that do not count. */
export const pekanSemesterSchema = z
  .object({
    pekan: z.array(z.object({ nomor: z.number().int().positive(), mulai: dateKey })).min(1),
    /** Weeks without a number (for example a holiday week that shifts the count). */
    dikecualikan: z.array(z.object({ mulai: dateKey, alasan: z.string().min(1) })).default([]),
    uts_pekan: z.number().int().positive().nullable(),
    uas_pekan: z.number().int().positive().nullable(),
    catatan: z.string().default(''),
  })
  .superRefine((v, ctx) => {
    v.pekan.forEach((p, i) => {
      if (p.nomor !== i + 1) ctx.addIssue({ code: 'custom', message: `pekan ${i + 1} bernomor ${p.nomor}` });
      if (new Date(`${p.mulai}T00:00:00Z`).getUTCDay() !== 1) ctx.addIssue({ code: 'custom', message: `pekan ${p.nomor} tidak mulai Senin` });
    });
  });
export type PekanSemester = z.infer<typeof pekanSemesterSchema>;

export const calendarFileSchema = z
  .object({
    skema: z.literal(1),
    /** "2026/2027". */
    tahun_ajaran: z.string().regex(/^\d{4}\/\d{4}$/),
    revisi: z.number().int().positive(),
    diperbarui: dateKey,
    diverifikasi_pada: dateKey,
    /** The calendar covers these days; after `berlaku_sampai` the data is out of date. */
    berlaku_mulai: dateKey,
    berlaku_sampai: dateKey,
    zona_waktu: z.literal('Asia/Makassar'),
    sumber: z.object({
      judul: z.string().min(1),
      sk: z.string().min(1),
      pdf_url: z.url(),
      pdf_sha256: z.string().regex(/^[0-9a-f]{64}$/),
      halaman_url: z.url(),
      ics_diunduh_pada: dateKey,
    }),
    kegiatan: z.array(kegiatanSchema),
    libur_nasional: z.array(liburSchema),
    pekan: z.object({ awal: pekanSemesterSchema.nullable(), akhir: pekanSemesterSchema.nullable() }),
  })
  .superRefine((v, ctx) => {
    const ids = [...v.kegiatan.map((k) => k.id), ...v.libur_nasional.map((l) => l.id)];
    const dup = ids.find((id, i) => ids.indexOf(id) !== i);
    if (dup) ctx.addIssue({ code: 'custom', message: `id ganda: ${dup}` });
    if (v.berlaku_sampai < v.berlaku_mulai) ctx.addIssue({ code: 'custom', message: 'berlaku_sampai lebih awal dari berlaku_mulai' });
  });
export type CalendarFile = z.infer<typeof calendarFileSchema>;

/** "2026/2027" -> 2026, for ordering academic years. */
export function startYear(tahunAjaran: string): number {
  return Number(tahunAjaran.slice(0, 4));
}
