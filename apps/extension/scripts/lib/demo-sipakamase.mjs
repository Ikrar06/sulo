// Synthetic Sipakamase data for the screenshots (1.1.0): the module on and
// signed in, every fragment read an hour ago, with made-up activity names.
// Shapes are core sipakamase/store.ts SipakamaseData; tests check them
// against the passive reader's schema (tests/sipakamase-demo.test.ts).

const H = 3600;
const act = (name, basis, kind, status, statusText, hasCompanion) => ({ semester: 'Awal 2026/2027', basis, kind, name, status, statusText, hasCompanion, hasScore: false });

export function demoSipakamase(now) {
  const at = now - H;
  const parts = {
    running: [
      act('Lomba Esai Lingkungan Kampus', 'kompetisi', 'Lomba Mandiri', 'done', 'Terlaksana', false),
      act('Pengurus Himpunan Mahasiswa Sintetis', 'keorganisasian', 'Kepengurusan', 'planned', 'Terencana', true),
    ],
    history: [{ ...act('Seminar Nasional Teknologi Sintetis', 'kepesertaan', 'Seminar', 'finished', 'Selesai', null), semester: 'Akhir 2025/2026', hasScore: true }],
    courses: {
      passed: [
        { name: 'Manajemen Kegiatan', sks: 2, collected: 2 },
        { name: 'Kepemimpinan Inovatif', sks: 2, collected: 2 },
      ],
      notPassed: [{ name: 'Pengambilan Keputusan', sks: 2, collected: 1.25 }],
    },
    claim: {
      passed: [
        { code: '23U02130202', name: 'Manajemen Kegiatan', sks: 2, inNeosia: true },
        { code: '23U02131102', name: 'Kepemimpinan Inovatif', sks: 2, inNeosia: false },
      ],
      programmed: [{ code: '23U02132304', kind: 'mkpk' }],
    },
    conversions: [
      { name: 'Lomba Esai Lingkungan Kampus', sksTotal: 0.58, sksUnconverted: 0.58 },
      { name: 'Seminar Nasional Teknologi Sintetis', sksTotal: 3.2, sksUnconverted: 0.92 },
    ],
  };
  const readAt = Object.fromEntries(Object.keys(parts).map((k) => [k, at]));
  return {
    'global:sipakamase': { enabled: true, changedAt: now - 3 * 86_400 },
    'sipakamase:connection': { state: 'live', since: at, cause: 'read_ok' },
    'sipakamase:data': { v: 1, readAt, changedAt: readAt, parts },
    'sipakamase:keeper': { next: 1, autoDate: '', autoCount: 0, lastAutoAt: at, lastRefreshAt: null },
  };
}
