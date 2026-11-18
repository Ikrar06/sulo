// Synthetic NEOSIA snapshots for pnpm guide:shots and the M7 screenshots:
// projected data only (the shape lib/neosia/allowlist.ts keeps), with made-up
// names and the demo courses' codes from fixtures/guide/demo-seed.json, so
// linking by code shows. Dates follow "now": the KRS window opens in 5 days.
// Never real data (docs/TESTING.md). tests/neosia-demo.test.ts checks every
// snapshot against the capture schema.

const DAY = 86_400;

const dateKey = (unix) => new Date(unix * 1000).toISOString().slice(0, 10);

const kelas = (kode, nama, kelasNama, sks, slots, dosen) => ({
  nama: kelasNama,
  is_batal: false,
  sks,
  mata_kuliah: { kode, nama_resmi: nama, nama_singkat: nama, sifat: 'W', semester: 5, mata_kuliah_sifat: { nama: 'Wajib' } },
  jadwal_kuliahs: slots.map(([day, start, end, ruang]) => ({ day_of_week: day, start_time: start, end_time: end, ruang: { kode: ruang.kode, nama: ruang.nama } })),
  dosens: [{ nama: dosen }],
});

const R = (kode, nama) => ({ kode, nama });

/** The snapshot map (endpoint → snapshot) and the module state. */
export function demoNeosia(now = Math.floor(Date.now() / 1000)) {
  const seen = now - 2 * 3600;
  const snap = (endpoint, data) => [`neosia:snap:${endpoint}`, { endpoint, v: 1, data, changedAt: seen, seenAt: seen, unknownShapeAt: null }];
  const data = {
    belanja_krs: {
      kartu_rencana_studi: {
        is_approved: false,
        is_locked: false,
        is_current: true,
        prodi_semester: { semester: { kode: '20262', jenis: 'Genap', tahun_ajaran: '2026/2027' } },
        kelas_kuliahs: [
          kelas('23D01110101', 'MEKANIKA FLUIDA', 'B', 3, [[1, '07:30:00', '10:00:00', R('R101', 'Ruang Kuliah 101')], [4, '07:30:00', '09:10:00', R('LH01', 'Lab Hidrolika')]], 'Dosen Contoh Satu'),
          kelas('23D01110202', 'PERENCANAAN WILAYAH', 'A', 3, [[2, '10:10:00', '12:40:00', R('R203', 'Ruang Kuliah 203')]], 'Dosen Contoh Dua'),
          kelas('23U01110303', 'ETIKA PROFESI DAN KOMUNIKASI BMI', 'C', 2, [[3, '13:00:00', '14:40:00', R('R105', 'Ruang Kuliah 105')]], 'Dosen Contoh Tiga'),
          kelas('23D01110505', 'HIDROLOGI TERAPAN', 'A', 3, [[5, '08:00:00', '10:30:00', R('R110', 'Ruang Kuliah 110')]], 'Dosen Contoh Empat'),
        ],
      },
    },
    checkJadwalBelanjaKRS: {
      status: true,
      prodiSemesterJadwalKrses: [
        { tanggal_mulai: dateKey(now + 5 * DAY), tanggal_berakhir: dateKey(now + 30 * DAY), semester_tipe_jadwal: { name: 'krs', caption: 'Pengisian KRS' } },
        { tanggal_mulai: dateKey(now + 40 * DAY), tanggal_berakhir: dateKey(now + 47 * DAY), semester_tipe_jadwal: { name: 'perubahan_krs', caption: 'Perubahan KRS' } },
      ],
    },
    max_sks: {
      max_sks: 24,
      limits: { total: 24, face_to_face: 24, non_face_to_face: 0 },
      current_sks: { total: 11, face_to_face: 11, non_face_to_face: 0, available: 13 },
      context: { student_level: 'S1', current_semester: 5, rules_applied: ['ips'] },
    },
    dashboard: { indeks_prestasi: { ipk: 3.42, jumlah_sks_dilulusi: 84 }, masa_studi: { maksimal: 14, sisa: 10 }, pembayaran: { sudah_bayar: true } },
    'prodi_semester/active': { activeProdiSemester: { is_active: true, semester: { kode: '20262', jenis: 'Genap', tahun: 2026, tahun_ajaran: '2026/2027', is_active: true } } },
    getTranskripMahasiswa: {
      transkrip: [
        { kode_mata_kuliah: '23D01110404', nama_mata_kuliah: 'STATISTIKA I', sks: 3, nilai_huruf: 'A-', id_semester: 20261, is_used: true, is_alih_kredit: false, is_manual: false, is_locked: true },
        { kode_mata_kuliah: '23D01110909', nama_mata_kuliah: 'KALKULUS II', sks: 3, nilai_huruf: 'B+', id_semester: 20252, is_used: true, is_alih_kredit: false, is_manual: false, is_locked: true },
      ],
      current_indeks_prestasi: { semester_tahun_ajaran: '2026/2027 Ganjil', indeks_prestasi_semester: 3.55, indeks_prestasi_kumulatif: 3.42, jumlah_sks: 84 },
    },
    'indeks_prestasi/current': { currentIndeksPrestasi: { semester_tahun_ajaran: '2026/2027 Ganjil', indeks_prestasi_semester: 3.55, indeks_prestasi_kumulatif: 3.42, jumlah_sks: 84 } },
    getStatusPembayaran: { status: true, pembayaran: { sudah_bayar: true } },
    check_survey_status: { is_filled: false },
  };
  return {
    'global:neosia': { enabled: true, changedAt: now - DAY },
    ...Object.fromEntries(Object.entries(data).map(([endpoint, d]) => snap(endpoint, d))),
  };
}
