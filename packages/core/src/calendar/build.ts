// ICS events + manual overrides from the PDF -> one validated calendar file,
// plus a report of every difference between the ICS and the final data.
// Pure; scripts/calendar/build.ts reads the files and writes the output.

import { categorize, jenjangOf, semesterOf, slug } from './categorize.ts';
import { addDays } from './dates.ts';
import type { IcsEvent } from './ics-parse.ts';
import { calendarFileSchema, type CalendarFile, type Kegiatan, type Libur, type PekanSemester } from './schema.ts';

/** Fields an override may set on an event (id included: some titles repeat). */
export type KegiatanPatch = Partial<Omit<Kegiatan, 'asal'>>;

export interface Overrides {
  tahun_ajaran: string;
  revisi: number;
  diperbarui: string;
  diverifikasi_pada: string;
  berlaku_mulai: string;
  berlaku_sampai: string;
  /** Events starting on or after this date belong to the even semester ("akhir") unless the title says otherwise. */
  semester_akhir_mulai: string;
  sumber: CalendarFile['sumber'];
  /** Corrections to ICS events, matched by exact ICS title and ICS start date. */
  ubah: { judul_ics: string; mulai_ics: string; alasan: string; set: KegiatanPatch }[];
  /** Events only in the PDF. */
  tambah: (Omit<Kegiatan, 'asal' | 'nilai_lain' | 'rincian' | 'catatan' | 'ujung_terbuka' | 'perkiraan'> & Partial<Kegiatan> & { alasan: string })[];
  libur_nasional: Libur[];
  pekan: {
    awal: PekanSpec | null;
    akhir: PekanSpec | null;
  };
}

/** Compact week spec; the data file holds the explicit list. */
export interface PekanSpec {
  mulai_pekan_1: string;
  jumlah: number;
  uts_pekan: number | null;
  uas_pekan: number | null;
  dikecualikan?: { mulai: string; alasan: string }[];
  catatan?: string;
}

export interface DiffEntry {
  jenis: 'diubah' | 'ditambah';
  id: string;
  judul: string;
  ics: { mulai: string; selesai: string } | null;
  akhir: { mulai: string; selesai: string | null };
  /** Fields that differ from what the ICS alone would give. */
  bidang: string[];
  alasan: string;
}

export interface BuildResult {
  file: CalendarFile;
  report: DiffEntry[];
}

export function expandWeeks(spec: PekanSpec): PekanSemester {
  const excluded = new Set((spec.dikecualikan ?? []).map((d) => d.mulai));
  const pekan: PekanSemester['pekan'] = [];
  let monday = spec.mulai_pekan_1;
  while (pekan.length < spec.jumlah) {
    if (!excluded.has(monday)) pekan.push({ nomor: pekan.length + 1, mulai: monday });
    monday = addDays(monday, 7);
  }
  return { pekan, dikecualikan: spec.dikecualikan ?? [], uts_pekan: spec.uts_pekan, uas_pekan: spec.uas_pekan, catatan: spec.catatan ?? '' };
}

function fromIcs(e: IcsEvent, o: Overrides): Kegiatan {
  const { kategori, audiens } = categorize(e.summary);
  const semester = semesterOf(e.summary, e.mulai, o.semester_akhir_mulai, o.tahun_ajaran);
  const year = o.tahun_ajaran.replace('/', '-');
  return {
    id: `${year}-${semester ?? 'lain'}-${slug(e.summary)}`,
    semester,
    kategori,
    judul: e.summary,
    mulai: e.mulai,
    selesai: e.selesai,
    ujung_terbuka: false,
    perkiraan: e.perkiraan,
    audiens,
    jenjang: jenjangOf(e.summary),
    status_verifikasi: 'cocok_ics_pdf',
    asal: 'ics',
    nilai_lain: [],
    rincian: [],
    catatan: e.perkiraan ? 'Perkiraan bulan; tanggal pastinya diumumkan kemudian.' : '',
  };
}

const COMPARED: (keyof Kegiatan)[] = ['id', 'semester', 'kategori', 'judul', 'mulai', 'selesai', 'ujung_terbuka', 'perkiraan', 'audiens', 'jenjang', 'status_verifikasi', 'nilai_lain', 'rincian', 'catatan'];

export function buildCalendar(ics: readonly IcsEvent[], o: Overrides): BuildResult {
  const report: DiffEntry[] = [];
  const used = new Set<number>();

  const kegiatan: Kegiatan[] = ics.map((e) => fromIcs(e, o));
  for (const change of o.ubah) {
    const index = ics.findIndex((e, i) => !used.has(i) && e.summary === change.judul_ics && e.mulai === change.mulai_ics);
    if (index < 0) throw new Error(`override tidak menemukan acara ICS: "${change.judul_ics}" ${change.mulai_ics}`);
    used.add(index);
    const base = kegiatan[index]!;
    const next: Kegiatan = { ...base, ...change.set };
    kegiatan[index] = next;
    const e = ics[index]!;
    report.push({
      jenis: 'diubah',
      id: next.id,
      judul: next.judul,
      ics: { mulai: e.mulai, selesai: e.selesai },
      akhir: { mulai: next.mulai, selesai: next.selesai },
      bidang: COMPARED.filter((k) => JSON.stringify(base[k]) !== JSON.stringify(next[k])),
      alasan: change.alasan,
    });
  }

  for (const add of o.tambah) {
    const { alasan, ...rest } = add;
    const item: Kegiatan = { ujung_terbuka: false, perkiraan: false, nilai_lain: [], rincian: [], catatan: '', ...rest, asal: 'pdf' };
    kegiatan.push(item);
    report.push({ jenis: 'ditambah', id: item.id, judul: item.judul, ics: null, akhir: { mulai: item.mulai, selesai: item.selesai }, bidang: [], alasan });
  }

  kegiatan.sort((a, b) => a.mulai.localeCompare(b.mulai) || a.id.localeCompare(b.id));
  const file = calendarFileSchema.parse({
    skema: 1,
    tahun_ajaran: o.tahun_ajaran,
    revisi: o.revisi,
    diperbarui: o.diperbarui,
    diverifikasi_pada: o.diverifikasi_pada,
    berlaku_mulai: o.berlaku_mulai,
    berlaku_sampai: o.berlaku_sampai,
    zona_waktu: 'Asia/Makassar',
    sumber: o.sumber,
    kegiatan,
    libur_nasional: [...o.libur_nasional].sort((a, b) => a.mulai.localeCompare(b.mulai)),
    pekan: { awal: o.pekan.awal ? expandWeeks(o.pekan.awal) : null, akhir: o.pekan.akhir ? expandWeeks(o.pekan.akhir) : null },
  });
  return { file, report };
}

const fmt = (r: { mulai: string; selesai: string | null } | null) => (r === null ? '-' : r.selesai === null ? `${r.mulai} sampai (terbuka)` : r.mulai === r.selesai ? r.mulai : `${r.mulai} sampai ${r.selesai}`);

/** The difference report as Markdown (docs/KALENDER-AKADEMIK.md and the build log). */
export function renderReport(report: readonly DiffEntry[], icsCount: number, file: CalendarFile): string {
  const lines = [
    `Acara di ICS: ${icsCount}. Kegiatan di data akhir: ${file.kegiatan.length} (${report.filter((r) => r.jenis === 'ditambah').length} ditambah dari PDF). Libur nasional: ${file.libur_nasional.length}.`,
    '',
    '| Jenis | Kegiatan | ICS | Data akhir | Bidang | Alasan |',
    '|---|---|---|---|---|---|',
    ...report.map((r) => `| ${r.jenis} | ${r.judul} | ${fmt(r.ics)} | ${fmt(r.akhir)} | ${r.bidang.join(', ') || '-'} | ${r.alasan} |`),
    '',
    `Libur nasional dan cuti bersama tidak ada di ICS; ke-${file.libur_nasional.length} entri berasal dari PDF (status_verifikasi awal "cocok_pdf", menunggu pencocokan dengan SKB 3 Menteri):`,
    '',
    '| Tanggal | Nama | Jenis | Status | Catatan |',
    '|---|---|---|---|---|',
    ...file.libur_nasional.map((l) => `| ${fmt(l)} | ${l.nama} | ${l.jenis} | ${l.status_verifikasi} | ${l.catatan || '-'} |`),
  ];
  return lines.join('\n');
}
