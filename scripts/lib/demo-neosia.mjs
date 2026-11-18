// Synthetic NEOSIA snapshots for pnpm guide:shots and the M7 screenshots:
// projected data only (the shape lib/neosia/allowlist.ts keeps), with made-up
// names and the demo courses' codes from fixtures/guide/demo-seed.json, so
// linking by code shows. Dates follow "now": the KRS window opens in 5 days.
// Never real data (docs/TESTING.md). tests/neosia-demo.test.ts checks every
// snapshot against the capture schema.

const DAY = 86_400;

const dateKey = (unix) => new Date(unix * 1000).toISOString().slice(0, 10);

const kelas = (kode, nama, kelasNama, sks, slots, dosen) => ({
  kode,
  nama,
  nama_kelas: kelasNama,
  sks,
  sifat: 'W',
  mata_kuliah: { kode, nama, sks },
  jadwal_kuliahs: slots.map(([day, start, end, ruang]) => ({ day_of_week: day, start_time: start, end_time: end, ruang })),
  dosens: [{ nama: dosen, gelar_depan: 'Dr.', gelar_belakang: 'M.T.' }],
});

/** The snapshot map (endpoint → snapshot) and the module state. */
export function demoNeosia(now = Math.floor(Date.now() / 1000)) {
  const seen = now - 2 * 3600;
  const snap = (endpoint, data) => [`neosia:snap:${endpoint}`, { endpoint, v: 1, data, changedAt: seen, seenAt: seen, unknownShapeAt: null }];
  const data = {
    belanja_krs: {
      kartu_rencana_studi: {
        is_approved: false,
        is_locked: false,
        semester: { kode: '20262', jenis: 'akhir', tahun_ajaran: '2026/2027' },
        kelas_kuliahs: [
          kelas('23D01110101', 'MEKANIKA FLUIDA', 'B', 3, [[1, '07:30:00', '10:00:00', { nama: 'Ruang Kuliah 101' }], [4, '07:30:00', '09:10:00', { nama: 'Lab Hidrolika' }]], 'Dosen Contoh Satu'),
          kelas('23D01110202', 'PERENCANAAN WILAYAH', 'A', 3, [[2, '10:10:00', '12:40:00', 'Ruang Kuliah 203']], 'Dosen Contoh Dua'),
          kelas('23U01110303', 'ETIKA PROFESI DAN KOMUNIKASI BMI', 'C', 2, [[3, '13:00:00', '14:40:00', 'Ruang Kuliah 105']], 'Dosen Contoh Tiga'),
          kelas('23D01110505', 'HIDROLOGI TERAPAN', 'A', 3, [[5, '08:00:00', '10:30:00', 'Ruang Kuliah 110']], 'Dosen Contoh Empat'),
        ],
      },
      semester: { kode: '20262', jenis: 'akhir', tahun_ajaran: '2026/2027' },
    },
    checkJadwalBelanjaKRS: {
      status: true,
      prodiSemesterJadwalKrses: [{ tanggal_mulai: dateKey(now + 5 * DAY), tanggal_berakhir: dateKey(now + 45 * DAY), semester_tipe_jadwal: { name: 'krs', caption: 'Pengisian KRS' } }],
    },
    max_sks: { max_sks: 24, current_sks: { total: 11, available: 13 }, context: { current_semester: 5, rules_applied: ['ips'] } },
    dashboard: { indeks_prestasi: { ipk: 3.42, jumlah_sks_dilulusi: 84 }, masa_studi: { maksimal: 14, sisa: 10 } },
    'prodi_semester/active': { semester: { kode: '20262', jenis: 'akhir', tahun_ajaran: '2026/2027' } },
    getTranskripMahasiswa: {
      transkrip: [
        { kode: '23D01110404', nama: 'STATISTIKA I', sks: 3, nilai_huruf: 'A-', id_semester: 20261, is_used: true, is_alih_kredit: false, is_manual: false },
        { kode: '23D01110909', nama: 'KALKULUS II', sks: 3, nilai_huruf: 'B+', id_semester: 20252, is_used: true, is_alih_kredit: false, is_manual: false },
      ],
      current_indeks_prestasi: { ipk: 3.42, ips: 3.55, jumlah_sks: 84 },
    },
    getCurrentPenasihatAkademik: { dosen: { nama: 'Dosen Pembimbing Contoh', gelar_depan: 'Dr.', gelar_belakang: 'S.T., M.Eng.' } },
    getStatusPembayaran: { status: 'LUNAS', is_lunas: true },
    check_survey_status: { is_filled: false },
  };
  return {
    'global:neosia': { enabled: true, changedAt: now - DAY },
    ...Object.fromEntries(Object.entries(data).map(([endpoint, d]) => snap(endpoint, d))),
  };
}
