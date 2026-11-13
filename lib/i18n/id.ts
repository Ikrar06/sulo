import type { ConnectionTestResult } from '../messages';

// All UI text, in concise Indonesian. No exclamation marks (docs/UI.md).
export const id = {
  appName: 'Sulo',
  unofficial: 'Untuk SIKOLA, tidak resmi',
  testConnection: 'Uji koneksi',
  testing: 'Menguji...',
  sesskeyAvailable: 'Sesi SIKOLA terdeteksi',
  sesskeyMissing: 'Belum ada sesi. Buka SIKOLA dulu.',
  budget: (used: number, limit: number) => `Request hari ini: ${used} dari ${limit}`,
  unexpectedError: 'Terjadi kesalahan di ekstensi',
  result: {
    ok: 'Terhubung. Sesi SIKOLA aktif.',
    no_sesskey: 'Buka SIKOLA dulu, lalu coba lagi.',
    session_expired: 'Sesi habis. Buka SIKOLA untuk login lagi.',
    invalid_sesskey: 'Sesi usang. Muat ulang halaman SIKOLA, lalu coba lagi.',
    budget_exhausted: 'Batas sinkron hari ini tercapai.',
    offline: 'Tidak terhubung ke SIKOLA.',
    server_error: 'SIKOLA sedang bermasalah. Coba lagi nanti.',
    parser_broken: 'SIKOLA berubah, respons tidak dikenali.',
  } satisfies Record<ConnectionTestResult, string>,
} as const;
