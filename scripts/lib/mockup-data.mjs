// Livelier synthetic data for mockups (pnpm shots:mockup), laid over the demo
// seed both apps already use (apps/extension/fixtures/guide/demo-seed.json):
// task titles that read like coursework instead of "Tugas 7", and no pile of
// overdue work on a screen meant to introduce Sulo. Written by hand; nothing
// here comes from a real account: no person, student number, email or grade.

/** Titles per course id of the demo seed, used in the order that course's tasks come. */
const TITLES = {
  // Mekanika Fluida
  401: [
    'Laporan praktikum aliran dalam pipa',
    'Latihan soal bilangan Reynolds',
    'Kuis pekan 8: kehilangan energi',
    'Tugas besar: jaringan pipa sederhana',
    'Ringkasan bab hidrostatika',
    'Lembar kerja persamaan Bernoulli',
    'Laporan praktikum ambang tajam',
    'Latihan soal aliran saluran terbuka',
    'Refleksi kunjungan laboratorium',
  ],
  // Perencanaan Wilayah
  402: [
    'Peta tata guna lahan kecamatan',
    'Ringkasan bacaan: struktur ruang kota',
    'Analisis kepadatan penduduk',
    'Presentasi kelompok: kawasan pesisir',
    'Esai singkat transportasi publik',
    'Kuis pekan 9: hierarki pusat layanan',
    'Sketsa rencana blok permukiman',
    'Tinjauan dokumen rencana tata ruang',
    'Laporan survei lapangan pasar',
  ],
  // Etika Profesi dan Komunikasi
  403: [
    'Esai kode etik insinyur',
    'Studi kasus: kegagalan konstruksi',
    'Latihan menulis surat resmi',
    'Presentasi lima menit',
    'Notula rapat kelompok',
    'Kuis pekan 7: tanggung jawab profesi',
    'Ulasan artikel keselamatan kerja',
    'Forum diskusi: konflik kepentingan',
  ],
  // Praktikum Lapangan Terpadu
  405: [
    'Logbook pekan 3',
    'Laporan survei topografi',
    'Data ukur sipat datar',
    'Gambar potongan memanjang',
    'Logbook pekan 4',
    'Laporan uji tanah lapangan',
    'Rekap data pengukuran poligon',
    'Draf laporan akhir kelompok',
  ],
};
const OTHER = ['Latihan soal pekan ini', 'Ringkasan bacaan', 'Kuis pekan 8', 'Laporan kelompok'];
/** Where an overdue task moves to, in hours from now: one nearly due, the rest in the days after. */
const AHEAD_HOURS = [3, 27, 51, 75];

/**
 * The demo tasks for a mockup: a new list, the given one untouched.
 * @param {readonly { courseId: number, name: string, dueAt: number | null, overdue?: boolean }[]} tasks
 * @param {number} now unix seconds
 */
export function livelyTasks(tasks, now) {
  const used = new Map();
  let moved = 0;
  return tasks.map((task) => {
    const titles = TITLES[task.courseId] ?? OTHER;
    const n = used.get(task.courseId) ?? 0;
    used.set(task.courseId, n + 1);
    const late = task.dueAt !== null && task.dueAt < now;
    const dueAt = late ? now + AHEAD_HOURS[moved++ % AHEAD_HOURS.length] * 3600 : task.dueAt;
    return { ...task, name: titles[n % titles.length], dueAt, ...(late ? { overdue: false } : {}) };
  });
}
