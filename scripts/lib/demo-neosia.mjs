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
  // v: the capture schema version (lib/neosia/allowlist.ts CAPTURE_SCHEMA_VERSION).
  const snap = (endpoint, data) => [`neosia:snap:${endpoint}`, { endpoint, v: 2, data, changedAt: seen, seenAt: seen, unknownShapeAt: null }];
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
          kelas('23D01110505', 'HIDROLOGI TERAPAN', 'A', 3, [[5, '07:50:00', '08:40:00', R('RS1', 'Ruang Sidang Lt.1')]], 'Dosen Contoh Empat'),
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
    // GPA and credits match the transcript below (Sulo's own count gives 2.95 and 27).
    dashboard: { indeks_prestasi: { ipk: 2.95, jumlah_sks_dilulusi: 27 }, masa_studi: { maksimal: 14, sisa: 10 }, pembayaran: { sudah_bayar: true } },
    'prodi_semester/active': { activeProdiSemester: { is_active: true, semester: { kode: '20262', jenis: 'Genap', tahun: 2026, tahun_ajaran: '2026/2027', is_active: true } } },
    getTranskripMahasiswa: {
      transkrip: [
        { kode_mata_kuliah: '23D01110011', nama_mata_kuliah: 'KALKULUS I', sks: 3, nilai_huruf: 'A', id_semester: 47, is_used: true, is_alih_kredit: false, is_manual: false, is_locked: true },
        { kode_mata_kuliah: '23D01110012', nama_mata_kuliah: 'FISIKA DASAR', sks: 3, nilai_huruf: 'B+', id_semester: 47, is_used: true, is_alih_kredit: false, is_manual: false, is_locked: true },
        { kode_mata_kuliah: '23D01110013', nama_mata_kuliah: 'BAHASA INDONESIA', sks: 2, nilai_huruf: 'A', id_semester: 47, is_used: true, is_alih_kredit: true, is_manual: false, is_locked: true },
        { kode_mata_kuliah: '23D01110021', nama_mata_kuliah: 'KALKULUS II', sks: 3, nilai_huruf: 'B', id_semester: 48, is_used: true, is_alih_kredit: false, is_manual: false, is_locked: true },
        { kode_mata_kuliah: '23D01110404', nama_mata_kuliah: 'STATISTIKA I', sks: 3, nilai_huruf: 'E', id_semester: 48, is_used: false, is_alih_kredit: false, is_manual: false, is_locked: true },
        { kode_mata_kuliah: '23D01110023', nama_mata_kuliah: 'MEKANIKA TEKNIK', sks: 3, nilai_huruf: 'B-', id_semester: 48, is_used: true, is_alih_kredit: false, is_manual: false, is_locked: true },
        { kode_mata_kuliah: '23D01110404', nama_mata_kuliah: 'STATISTIKA I', sks: 3, nilai_huruf: 'C', id_semester: 49, is_used: true, is_alih_kredit: false, is_manual: false, is_locked: true },
        { kode_mata_kuliah: '23D01110032', nama_mata_kuliah: 'HIDROLIKA', sks: 3, nilai_huruf: 'D', id_semester: 49, is_used: true, is_alih_kredit: false, is_manual: false, is_locked: true },
        { kode_mata_kuliah: '23D01110033', nama_mata_kuliah: 'GAMBAR TEKNIK', sks: 2, nilai_huruf: 'A-', id_semester: 49, is_used: true, is_alih_kredit: false, is_manual: false, is_locked: true },
        { kode_mata_kuliah: '23D01110041', nama_mata_kuliah: 'MEKANIKA TANAH', sks: 3, nilai_huruf: 'B+', id_semester: 50, is_used: true, is_alih_kredit: false, is_manual: false, is_locked: true },
        { kode_mata_kuliah: '23D01110042', nama_mata_kuliah: 'ETIKA PROFESI', sks: 2, nilai_huruf: 'C+', id_semester: 50, is_used: true, is_alih_kredit: false, is_manual: false, is_locked: true },
      ],
      current_indeks_prestasi: { semester_tahun_ajaran: '2024/2025 Genap', indeks_prestasi_semester: 3.1, indeks_prestasi_kumulatif: 2.95, jumlah_sks: 27 },
    },
    // Transcript rows point to semesters by their internal id (47 to 50), mapped through semesters[].id.
    'mahasiswa/semester': {
      semesters: [
        { id: 47, kode: '20231', jenis: 'Ganjil', tahun: 2023, tahun_ajaran: '2023/2024', is_active: false },
        { id: 48, kode: '20232', jenis: 'Genap', tahun: 2023, tahun_ajaran: '2023/2024', is_active: false },
        { id: 49, kode: '20241', jenis: 'Ganjil', tahun: 2024, tahun_ajaran: '2024/2025', is_active: false },
        { id: 50, kode: '20242', jenis: 'Genap', tahun: 2024, tahun_ajaran: '2024/2025', is_active: false },
      ],
    },
    'indeks_prestasi/current': { currentIndeksPrestasi: { semester_tahun_ajaran: '2024/2025 Genap', indeks_prestasi_semester: 3.1, indeks_prestasi_kumulatif: 2.95, jumlah_sks: 27 } },
    check_survey_status: { is_filled: false },
    getCurrentPenasihatAkademik: { currentPenasihatAkademik: { dosen: { nama: 'Dr. Dosen Contoh Lima, S.T., M.T.' } } },
  };
  return {
    'global:neosia': { enabled: true, changedAt: now - DAY },
    ...Object.fromEntries(Object.entries(data).map(([endpoint, d]) => snap(endpoint, d))),
  };
}
