// Synthetic NEOSIA responses (never real data, docs/TESTING.md). Their key
// structure follows the owner's observation of 18 Nov 2026
// (docs/sumber/neosia-observasi.md) exactly, including the full student
// object, lecturers with NIP/NIDN/NUPTK, payment amount and bank, and the
// survey link. Every sensitive value is a distinctive made-up marker (or the
// leak scanner's placeholder), so the tests can prove it never survives.

import type { EndpointId } from '../lib/neosia/allowlist';

export const PLACEHOLDER = {
  nim: 'D000000001',
  nik: '0000000000000001',
  nip: '000000000000000001',
} as const;

/** Values that must never appear in a projection or in storage. */
export const SECRET = {
  nik: PLACEHOLDER.nik,
  nisn: 'NISN-SINTETIS-77',
  whatsapp: 'WA-SINTETIS-0800',
  jalan: 'Jalan Sintetis Kenari',
  rt: 'RT-SINTETIS-07',
  rw: 'RW-SINTETIS-09',
  dusun: 'Dusun Sintetis Mawar',
  tanggal_lahir: '1999-12-31',
  nip: PLACEHOLDER.nip,
  nidn: 'NIDN-SINTETIS-11',
  nuptk: 'NUPTK-SINTETIS-22',
  nominal: 7654321,
  bank: 'Bank Sintetis Raya',
  nilai_angka: 87.65,
  total_nilai: 263.95,
  survey_url: 'https://survey.example.invalid/isi?key=SESSKEY',
  nim: PLACEHOLDER.nim,
  nama_mahasiswa: 'Mahasiswa Sintetis Contoh',
  prodi_email: 'prodi@example.invalid',
} as const;

const PRODI = {
  id: 9,
  kode_dikti: '22201',
  nama_resmi: 'Prodi Sintetis',
  nama_singkat: 'PS',
  nama_asing: 'Synthetic Programme',
  nama_asing_singkat: 'SP',
  id_prodi_jenjang: 3,
  is_eksakta: true,
  alamat: 'Alamat Prodi Sintetis',
  nomor_telepon: 'TELP-PRODI-SINTETIS',
  fax: 'FAX-SINTETIS',
  email: SECRET.prodi_email,
  website: 'https://prodi.example.invalid',
  is_active: true,
};

const MAHASISWA = {
  deleted_at: null,
  id: 5001,
  id_user: 6001,
  id_prodi: 9,
  id_peminatan: null,
  id_jalur_masuk: 2,
  angkatan: 2023,
  nama_mahasiswa: SECRET.nama_mahasiswa,
  nim: SECRET.nim,
  jalan: SECRET.jalan,
  rt: SECRET.rt,
  rw: SECRET.rw,
  dusun: SECRET.dusun,
  kode_pos: 'KODEPOS-SINTETIS',
  nisn: SECRET.nisn,
  tempat_lahir: 'Kota Sintetis',
  tanggal_lahir: SECRET.tanggal_lahir,
  id_agama: 1,
  id_prodi_jenjang: 3,
  kelurahan: 'Kelurahan Sintetis',
  id_wilayah: '000000',
  nik: SECRET.nik,
  jenis_kelamin: 'L',
  is_active: true,
  updated_by: 1,
  kode_status: 'A',
  is_tamu: false,
  id_mahasiswa_pddikti: 'pddikti-sintetis',
  id_registrasi_mahasiswa_pddikti: 'registrasi-sintetis',
  spp: 'SPP-SINTETIS',
  whatsapp: SECRET.whatsapp,
  is_research_track: false,
  prodi: PRODI,
};

const DOSEN = (nama: string) => ({ id: 31, id_user: 41, id_prodi: 9, nama, nidn: SECRET.nidn, nuptk: SECRET.nuptk, nip: SECRET.nip, is_active: true, pivot: { id_kelas_kuliah: 1, id_dosen: 31 } });

const RUANG = (kode: string, nama: string) => ({
  id: 71,
  id_gedung: 2,
  id_guna_ruang: 1,
  kode,
  lantai: 1,
  nomor: '01',
  nama,
  kapasitas: 40,
  kapasitas_ujian: 30,
  is_kuliah: true,
  is_layak_pakai: true,
  luas: 64,
  telepon: 'TELP-RUANG-SINTETIS',
  catatan: 'Catatan ruang sintetis',
  id_tipe_kepemilikan_laboratorium: null,
  id_tipe_lokasi_laboratorium: null,
  id_prodi_penanggungjawab: 9,
  updated_by: 1,
});

const MATA_KULIAH = (kode: string, nama: string, skses: number[]) => ({
  id: 801,
  is_active: true,
  nama_resmi: nama,
  nama_singkat: nama.slice(0, 12),
  nama_asing: `${nama} (EN)`,
  nama_asing_singkat: 'EN',
  id_prodi: 9,
  id_kurikulum: 4,
  semester: 5,
  sifat: 'W',
  id_prodi_jenjang: 3,
  kode,
  is_mata_kuliah_umum: false,
  id_pddikti: 'mk-pddikti',
  id_kelas_kuliah_jenis: 1,
  is_kemajuan_studi: false,
  mata_kuliah_jumlah_skses: skses.map((jumlah_sks, i) => ({ id: 900 + i, id_mata_kuliah: 801, id_tipe_sks: i + 1, jumlah_sks })),
  mata_kuliah_sifat: { id: 1, kode: 'W', singkatan: 'W', nama: 'Wajib' },
});

const JADWAL = (day: number, start: string, end: string, ruang: ReturnType<typeof RUANG>) => ({
  id: 61,
  start_time: start,
  end_time: end,
  id_ruang: 71,
  maximum_capacity: 40,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
  day_of_week: day,
  id_kelas_kuliah: 1,
  updated_by: 1,
  ruang,
});

const KELAS = (kode: string, nama: string, kelas: string, skses: number[], jadwal: ReturnType<typeof JADWAL>[], dosen: string, batal = false) => ({
  id: 1,
  id_prodi_semester: 3,
  id_mata_kuliah: 801,
  nama: kelas,
  max_participant: 40,
  id_kelas_kuliah_jenis: 1,
  id_kelas_kuliah_jenis_sub_kelas: null,
  id_parent: null,
  is_blok: false,
  is_antara_semester: false,
  nama_pddikti: `${kelas}-pddikti`,
  is_batal: batal,
  id_jenis_pertemuan: 1,
  deleted_at: null,
  pivot: { id_kartu_rencana_studi: 11, id_kelas_kuliah: 1 },
  mata_kuliah: MATA_KULIAH(kode, nama, skses),
  jadwal_kuliahs: jadwal,
  dosens: [DOSEN(dosen)],
});

const SEMESTER = { id: 20262, tahun: 2026, kode: '20262', jenis: 'Genap', is_active: true, tahun_ajaran: '2026/2027' };
const IP = { id: 3, id_mahasiswa: 5001, nim: SECRET.nim, id_semester: 20261, tahun: 2026, semester_tahun_ajaran: '2026/2027 Ganjil', indeks_prestasi_semester: 3.6, indeks_prestasi_kumulatif: 3.51, is_gtakademik: false, updated_by: 1, created_at: 'x', updated_at: 'x', jumlah_sks: 64 };

export const SYNTHETIC: Record<EndpointId, unknown> = {
  belanja_krs: {
    message: 'Halo Mahasiswa Sintetis Contoh',
    kartu_rencana_studi: {
      id: 11,
      id_prodi_semester: 3,
      id_mahasiswa: 5001,
      is_approved: true,
      is_current: true,
      is_locked: false,
      kelas_kuliahs: [
        KELAS('23D12100001', 'MEKANIKA FLUIDA', 'A', [2, 1], [JADWAL(1, '07:30:00', '10:00:00', RUANG('R101', 'Ruang Kuliah 101'))], 'Dosen Satu'),
        KELAS('23D12100002', 'STATISTIKA', 'B', [2], [JADWAL(3, '13:00:00', '14:40:00', RUANG('LK2', 'Lab Komputer 2'))], 'Dosen Dua'),
        KELAS('23D12100009', 'MATA KULIAH BATAL', 'C', [3], [JADWAL(5, '08:00:00', '10:30:00', RUANG('R110', 'Ruang Kuliah 110'))], 'Dosen Tiga', true),
      ],
      prodi_semester: { id: 3, id_semester: 20262, id_prodi: 9, is_active: true, is_used: true, semester: SEMESTER },
      mahasiswa: MAHASISWA,
    },
  },
  max_sks: {
    max_sks: 24,
    limits: { total: 24, face_to_face: 24, non_face_to_face: 0 },
    current_sks: { total: 5, face_to_face: 5, non_face_to_face: 0, available: 19 },
    context: { student_level: 'S1', current_semester: 4, is_research_track: false, rules_applied: ['ips_based'] },
  },
  checkJadwalBelanjaKRS: {
    status: true,
    message: 'Halo Mahasiswa Sintetis Contoh, jadwal KRS tersedia',
    prodiSemesterJadwalKrses: [
      { id: 3, id_prodi_semester: 3, id_semester_tipe_jadwal: 1, tanggal_mulai: '2027-01-03', tanggal_berakhir: '2027-02-12', semester_tipe_jadwal: { id: 1, name: 'krs', caption: 'Pengisian KRS' } },
      { id: 4, id_prodi_semester: 3, id_semester_tipe_jadwal: 2, tanggal_mulai: '2027-02-22', tanggal_berakhir: '2027-03-01', semester_tipe_jadwal: { id: 2, name: 'perubahan_krs', caption: 'Perubahan KRS' } },
    ],
  },
  kelas_kuliah_tersedia: {
    message: 'ok',
    semesters: {
      '4': [
        {
          ...KELAS('23D12100003', 'HIDROLOGI', 'A', [3], [JADWAL(2, '09:40:00', '12:10:00', RUANG('R102', 'Ruang Kuliah 102'))], 'Dosen Empat'),
          peserta_disetujui_count: 12,
          peserta_belum_disetujui_count: 3,
          mata_kuliah: { ...MATA_KULIAH('23D12100003', 'HIDROLOGI', [3]), mata_kuliah_prasyarats: [{ id: 1, kode: '23D12100010', nama_resmi: 'KALKULUS I' }] },
        },
      ],
    },
  },
  'prodi_semester/active': { activeProdiSemester: { id: 3, id_semester: 20262, id_prodi: 9, is_active: true, is_used: true, semester: SEMESTER } },
  dashboard: {
    identitas: { nama_mahasiswa: SECRET.nama_mahasiswa, nim: SECRET.nim, prodi: 'Prodi Sintetis' },
    pembayaran: { sudah_bayar: true, sumber_biaya: 'Sumber Sintetis', bank: SECRET.bank, nominal: SECRET.nominal, id_mahasiswa: 5001 },
    nilai_tes_eksternals: [{ nilai: 550 }],
    indeks_prestasi: { ipk: 3.51, jumlah_sks_dilulusi: 64 },
    masa_studi: { maksimal: 14, sisa: 10 },
    tugas_akhir: null,
    tugas_akhir_berita_acara: null,
    kemajuan_studi: { total_nilai: SECRET.total_nilai },
  },
  getTranskripMahasiswa: {
    message: 'ok',
    mahasiswa: { ...MAHASISWA, prodi: { ...PRODI, fakultas: { id: 1, nama_resmi: 'Fakultas Sintetis', alamat: 'Alamat Fakultas', email: SECRET.prodi_email } }, prodi_jenjang: { id: 3, kode: 'S1', nama: 'Sarjana', max_sks: 24 } },
    transkrip: [
      { id: 1, id_mahasiswa: 5001, nim: SECRET.nim, id_semester: 20251, id_kelas_kuliah: 1, id_mata_kuliah: 801, kode_mata_kuliah: '23D12100010', nama_mata_kuliah: 'KALKULUS I', nama_asing_mata_kuliah: 'CALCULUS I', nilai_angka: SECRET.nilai_angka, nilai_huruf: 'A', sks: 3, total_nilai: SECRET.total_nilai, is_used: true, is_verified: true, is_gtakademik: false, updated_by: 1, created_at: 'x', updated_at: 'x', is_manual: false, is_alih_kredit: false, is_locked: true, mata_kuliah: MATA_KULIAH('23D12100010', 'KALKULUS I', [3]) },
      { id: 2, id_mahasiswa: 5001, nim: SECRET.nim, id_semester: 20251, id_kelas_kuliah: 2, id_mata_kuliah: 802, kode_mata_kuliah: '23D12100011', nama_mata_kuliah: 'FISIKA DASAR', nama_asing_mata_kuliah: 'BASIC PHYSICS', nilai_angka: 78, nilai_huruf: 'B+', sks: 3, total_nilai: 234, is_used: true, is_verified: true, is_gtakademik: false, updated_by: 1, created_at: 'x', updated_at: 'x', is_manual: false, is_alih_kredit: false, is_locked: true, mata_kuliah: MATA_KULIAH('23D12100011', 'FISIKA DASAR', [3]) },
    ],
    current_indeks_prestasi: IP,
  },
  'indeks_prestasi/current': { currentIndeksPrestasi: IP },
  'kartu_hasil_studi/semester': {
    message: 'ok',
    kartu_hasil_studi: [{ mata_kuliah: MATA_KULIAH('23D12100010', 'KALKULUS I', [2, 1]), nilai_huruf: 'A', nilai_angka: SECRET.nilai_angka, source: 'krs', id_kelas_kuliah: 1 }],
    // Observed with no keys under it: not an object, so it is dropped.
    indeks_prestasi: 3.6,
  },
  'mahasiswa/semester': { semesters: [{ id: 20251, tahun: 2025, kode: '20251', jenis: 'Ganjil', is_active: false, tahun_ajaran: '2025/2026' }, { ...SEMESTER }] },
  check_survey_status: { is_filled: false, survey_url: SECRET.survey_url },
};
