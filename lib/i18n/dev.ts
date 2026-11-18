// Development-only wording: the popup's build info panel, the session
// probe and the fixture recorder. Imported only behind
// import.meta.env.MODE === 'development' (lazy or dynamic imports), so no
// other build contains it; scripts/check-no-dev-code.mjs fails if it leaks.

const id = {
    dev: {
      title: 'Info build dev',
      requests: (used: number, limit: number) => `Request hari ini: ${used} dari ${limit}`,
      withCourseList: (n: number) => `${n} di antaranya membawa daftar course`,
      calls: (used: number, limit: number) => `Panggilan fungsi hari ini: ${used} dari ${limit}`,
      openMs: (ms: number) => `Waktu buka popup: ${ms} ms`,
      log: (n: number) => `${n} request terakhir`,
      logEmpty: 'Belum ada request tercatat.',
      probe: 'Cek sisa waktu sesi',
      probeResult: (minutes: number) => `Sisa sesi SIKOLA: ${minutes} menit`,
      probeFailed: (reason: string) => `Gagal: ${reason}`,
      sources: {
        background: 'Latar belakang',
        startup: 'Browser dibuka',
        idle: 'Kembali aktif',
        popup: 'Popup',
        manual: 'Tombol perbarui',
        onboarding: 'Pengaturan awal',
        'connection-test': 'Cek koneksi',
        'sesskey-fallback': 'Cadangan sesskey',
        'dev-probe': 'Cek sesi (dev)',
        sesskey: 'Sesskey baru',
        relogin: 'Masuk lagi ke SIKOLA',
        recorder: 'Perekam',
      },
    },
    recorder: {
    title: 'Perekam fixture',
    note: 'Hanya ada di build dev. Memakai 2 request dari anggaran harian. Semua respons disanitasi sebelum disimpan.',
    start: 'Rekam fixture',
    recording: 'Merekam...',
    saved: (n: number) => `${n} berkas tersimpan di folder Unduhan. Simpan di luar git, lalu jalankan pnpm fixtures:compare.`,
    failed: (reason: string) => `Gagal merekam: ${reason}`,
    leak: (rules: string) => `Dibatalkan. Masih ada pola bocor setelah sanitasi: ${rules}. Tidak ada berkas yang disimpan.`,
    schemaInvalid: (fn: string, issues: number) => `${fn}: skema tidak cocok (${issues} masalah), tetap direkam`,
  },
};

const en: typeof id = {
    dev: {
      title: 'Dev build info',
      requests: (used, limit) => `Requests today: ${used} of ${limit}`,
      withCourseList: (n) => `${n} of them included the course list`,
      calls: (used, limit) => `Function calls today: ${used} of ${limit}`,
      openMs: (ms) => `Popup open time: ${ms} ms`,
      log: (n) => `Last ${n} requests`,
      logEmpty: 'No requests logged yet.',
      probe: 'Check session time left',
      probeResult: (minutes) => `SIKOLA session left: ${minutes} minutes`,
      probeFailed: (reason) => `Failed: ${reason}`,
      sources: {
        background: 'Background',
        startup: 'Browser opened',
        idle: 'Back from idle',
        popup: 'Popup',
        manual: 'Update button',
        onboarding: 'Setup',
        'connection-test': 'Connection check',
        'sesskey-fallback': 'Sesskey fallback',
        'dev-probe': 'Session check (dev)',
        sesskey: 'New sesskey',
        relogin: 'Signed in to SIKOLA again',
        recorder: 'Recorder',
      },
    },
    recorder: {
    title: 'Fixture recorder',
    note: 'Dev build only. Uses 2 requests from the daily budget. Every response is sanitized before it is saved.',
    start: 'Record fixtures',
    recording: 'Recording...',
    saved: (n) => `${n} files saved to Downloads. Keep them outside git, then run pnpm fixtures:compare.`,
    failed: (reason) => `Recording failed: ${reason}`,
    leak: (rules) => `Cancelled. Leak patterns remain after sanitizing: ${rules}. No files were saved.`,
    schemaInvalid: (fn, issues) => `${fn}: schema mismatch (${issues} issues), recorded anyway`,
  },
};

export const DEV_WORDS = { id, en };

export type DevWords = (typeof DEV_WORDS)['id'];
