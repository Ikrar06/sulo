import type { ConnectionTestResult } from '../messages';

// All UI text, in concise Indonesian. No exclamation marks.
export const id = {
  appName: 'Sulo',
  tagline: 'Pendamping akademik mahasiswa',
  // Shown once per surface (popup footer, dashboard, consent screens).
  disclaimer: 'Tidak resmi dan tidak berafiliasi dengan Universitas Hasanuddin.',
  testConnection: 'Uji koneksi',
  testing: 'Menguji...',
  sesskeyAvailable: 'Sesi SIKOLA terdeteksi',
  sesskeyMissing: 'Belum ada sesi. Buka SIKOLA dulu.',
  budget: (used: number, limit: number) => `Request hari ini: ${used} dari ${limit}`,
  unexpectedError: 'Terjadi kesalahan di ekstensi',
  disabledRemotely: 'Sulo sedang dinonaktifkan sementara.',
  staleData: (hours: number) => `Data terakhir diperbarui ${hours} jam lalu`,
  result: {
    ok: 'Terhubung. Sesi SIKOLA aktif.',
    no_sesskey: 'Buka SIKOLA dulu, lalu coba lagi.',
    session_expired: 'Sesi habis. Buka SIKOLA untuk login lagi.',
    invalid_sesskey: 'Sesi usang. Muat ulang halaman SIKOLA, lalu coba lagi.',
    budget_exhausted: 'Batas sinkron hari ini tercapai.',
    backing_off: 'SIKOLA sempat gagal dihubungi. Sulo menunggu sebelum mencoba lagi.',
    disabled_remotely: 'Sulo sedang dinonaktifkan sementara.',
    offline: 'Tidak terhubung ke SIKOLA.',
    server_error: 'SIKOLA sedang bermasalah. Coba lagi nanti.',
    parser_broken: 'SIKOLA berubah, respons tidak dikenali.',
  } satisfies Record<ConnectionTestResult, string>,
  recorder: {
    title: 'Perekam fixture',
    note: 'Hanya ada di build dev. Memakai 2 request dari anggaran harian. Semua respons disanitasi sebelum disimpan.',
    start: 'Rekam fixture',
    recording: 'Merekam...',
    saved: (n: number) => `${n} berkas tersimpan di folder Unduhan. Pindahkan ke fixtures/, lalu jalankan check-leaks.`,
    failed: (reason: string) => `Gagal merekam: ${reason}`,
    leak: (rules: string) => `Dibatalkan. Masih ada pola bocor setelah sanitasi: ${rules}. Tidak ada berkas yang disimpan.`,
    schemaInvalid: (fn: string, issues: number) => `${fn}: skema tidak cocok (${issues} masalah), tetap direkam`,
  },
} as const;
