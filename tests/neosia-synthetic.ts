// Synthetic NEOSIA responses (never real data, docs/TESTING.md). Shapes follow
// the November observation in the brief (section 2.2), with every sensitive
// field present and filled with the scanner's placeholder values, so the
// tests prove they are dropped. Names are made up.

import type { EndpointId } from '../lib/neosia/allowlist';

export const PLACEHOLDER = {
  nim: 'D000000001',
  nik: '0000000000000001',
  nip: '000000000000000001',
} as const;

const MAHASISWA = {
  nim: PLACEHOLDER.nim,
  nama: 'Mahasiswa Contoh',
  nik: PLACEHOLDER.nik,
  nisn: '0000000001',
  alamat: 'Jalan Contoh No. 1',
  tanggal_lahir: '2000-01-01',
  tempat_lahir: 'Kota Contoh',
  email: 'contoh@example.invalid',
  no_hp: '080000000001',
  nama_ibu: 'Ibu Contoh',
};

const DOSEN = { nama: 'Dosen Satu', gelar_depan: 'Dr.', gelar_belakang: 'S.T., M.T.', nip: PLACEHOLDER.nip, nidn: '0000000001', nuptk: '0000000000000001', email: 'dosen@example.invalid' };

const kelas = (kode: string, nama: string, kelasNama: string, sks: number, day: number, start: string, end: string, ruang: unknown) => ({
  id: 991,
  kode,
  nama,
  nama_kelas: kelasNama,
  sks,
  sifat: 'W',
  mata_kuliah: { id: 77, kode, nama, sks },
  jadwal_kuliahs: [{ id: 5, day_of_week: day, start_time: start, end_time: end, ruang }],
  dosens: [DOSEN],
});

export const SYNTHETIC: Record<EndpointId, unknown> = {
  belanja_krs: {
    data: {
      mahasiswa: MAHASISWA,
      kartu_rencana_studi: {
        id: 123,
        is_approved: true,
        is_locked: false,
        semester: { kode: '20262', jenis: 'akhir', tahun_ajaran: '2026/2027', id_semester: 20262 },
        kelas_kuliahs: [
          kelas('23D12100001', 'MEKANIKA FLUIDA', 'A', 3, 1, '07:30:00', '10:00:00', { nama: 'Ruang Kuliah 101', kode: 'R101' }),
          kelas('23D12100002', 'STATISTIKA', 'B', 2, 3, '13:00:00', '14:40:00', 'Lab Komputer 2'),
        ],
      },
      semester: { kode: '20262', jenis: 'akhir', tahun_ajaran: '2026/2027' },
    },
  },
  checkJadwalBelanjaKRS: {
    status: true,
    message: 'Halo Mahasiswa Contoh, jadwal KRS tersedia',
    prodiSemesterJadwalKrses: [{ id: 3, tanggal_mulai: '2027-01-03', tanggal_berakhir: '2027-02-12', semester_tipe_jadwal: { name: 'krs', caption: 'Pengisian KRS' } }],
  },
  kelas_kuliah_tersedia: {
    semesters: {
      '4': [{ ...kelas('23D12100003', 'HIDROLOGI', 'A', 3, 2, '09:40:00', '12:10:00', 'R102'), max_participant: 40, approved_participant: 12 }],
    },
  },
  max_sks: {
    max_sks: 24,
    limits: { rule: 'ips>=3' },
    current_sks: { total: 5, available: 19 },
    context: { current_semester: 4, student_level: 'S1', rules_applied: ['ips_based'], nim: PLACEHOLDER.nim },
  },
  dashboard: {
    indeks_prestasi: { ipk: 3.51, jumlah_sks_dilulusi: 64, nilai_angka: 87.5 },
    masa_studi: { maksimal: 14, sisa: 10 },
    tugas_akhir: null,
    nilai_tes_eksternals: [],
    kemajuan_studi: { total_nilai: 1234 },
  },
  'prodi_semester/active': { semester: { kode: '20262', jenis: 'akhir', tahun_ajaran: '2026/2027' } },
  getTranskripMahasiswa: {
    mahasiswa: MAHASISWA,
    transkrip: [
      { id: 1, kode: '23D12100010', nama: 'KALKULUS I', sks: 3, nilai_huruf: 'A', nilai_angka: 90, total_nilai: 270, id_semester: 20251, is_used: true, is_alih_kredit: false, is_manual: false },
      { id: 2, kode: '23D12100011', nama: 'FISIKA DASAR', sks: 3, nilai_huruf: 'B+', nilai_angka: 78, id_semester: 20251, is_used: true, is_alih_kredit: false, is_manual: false },
    ],
    current_indeks_prestasi: { ipk: 3.51, ips: 3.6, jumlah_sks: 64 },
  },
  'indeks_prestasi/current': { ips: 3.6, ipk: 3.51, jumlah_sks: 64, id_semester: 20261, nim: PLACEHOLDER.nim },
  'mahasiswa/semester': { data: [{ id_semester: 20251, kode: '20251', nama: 'Semester Awal 2025/2026', ips: 3.4, ipk: 3.4, nim: PLACEHOLDER.nim }] },
  'kartu_hasil_studi/semester': { kartu_hasil_studi: [{ kode: '23D12100010', nama: 'KALKULUS I', sks: 3, nilai_huruf: 'A', nilai_angka: 90, id_semester: 20251 }], ips: 3.6, ipk: 3.51 },
  getCurrentPenasihatAkademik: { data: { dosen: DOSEN, nip: PLACEHOLDER.nip } },
  getStatusPembayaran: { data: { status: 'LUNAS', is_lunas: true, nominal: 2500000, bank: 'Bank Contoh', virtual_account: '0000000000000001', tagihan: 'Rp 2.500.000' } },
  check_survey_status: { is_filled: false, survey_url: 'https://survey.example.invalid/?key=SESSKEY' },
};
