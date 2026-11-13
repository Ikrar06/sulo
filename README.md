# Sulo (starter)

Sulo berarti obor dalam bahasa Bugis dan Makassar. Ini ekstensi browser tidak resmi untuk SIKOLA yang menampilkan tugas lintas mata kuliah, pengingat tenggat, dan radar perubahan. Sulo tidak berafiliasi dengan Universitas Hasanuddin.

Paket ini adalah titik awal untuk membangunnya bersama Claude Code. Isinya dokumen arsitektur, aturan, kontrak tipe, dan perkakas pengaman. Kode ekstensi belum ada, karena scaffold WXT sebaiknya dibuat dengan versi perkakas terbaru saat proyek dimulai.

## Isi

| Berkas | Guna |
|---|---|
| `CLAUDE.md` | Aturan proyek yang otomatis dibaca Claude Code |
| `PROMPT-PEMBUKA.md` | Prompt pertama untuk ditempel ke Claude Code |
| `docs/ARCHITECTURE.md` | Komponen, alur sinkronisasi, storage, radar, sesi |
| `docs/ATURAN-REQUEST.md` | Batas request, backoff, allowlist, tombol mati |
| `docs/API-MOODLE.md` | Endpoint yang sudah diuji dan yang masih perlu dikonfirmasi |
| `docs/ROADMAP.md` | Cek sebelum M0, lalu M0 sampai M5 dengan kriteria selesai |
| `docs/UI.md` | Rancangan popup, dashboard, state, komponen |
| `docs/TESTING.md` | Strategi test dan sanitasi fixture |
| `docs/PRIVASI.md` | Draf kebijakan privasi dan bahan bicara dengan pengelola |
| `docs/PASANG.md` | Kerangka panduan pasang untuk penguji |
| `contracts/types.ts` | Kontrak tipe awal |
| `scripts/verify-console.js` | Skrip verifikasi endpoint dari Console |
| `scripts/check-leaks.mjs` | Pemindai data pribadi sebelum commit |
| `.githooks/pre-commit` | Menjalankan pemindai di setiap commit |
| `.github/workflows/ci.yml` | Pemindai, typecheck, test, build di GitHub Actions |
| `.github/ISSUE_TEMPLATE/laporan-bug.md` | Templat laporan bug untuk penguji |
| `.claude/settings.json` | Melarang Claude Code membaca data mentah dan berkas `.env` |
| `remote-config/config.example.json` | Contoh file tombol mati |
| `LICENSE` | MIT |

## Mulai

1. Ekstrak zip, masuk ke foldernya.
2. Jalankan `git init`, lalu `git config core.hooksPath .githooks` supaya pemindai aktif di setiap commit.
3. Buat repo privat di GitHub. Repo dibuka ke publik setelah bicara dengan pengelola SIKOLA.
4. Kerjakan daftar "Sebelum M0" di `docs/ROADMAP.md` (cek manual di browser, sekitar 15 menit).
5. Pastikan Node.js LTS dan pnpm terpasang, lalu jalankan `claude` di folder ini.
6. Tempel isi `PROMPT-PEMBUKA.md`.
7. Setelah M0 selesai, muat ekstensi dari `.output/chrome-mv3` lewat `chrome://extensions` (mode pengembang, "Load unpacked"), buka SIKOLA, lalu tekan "Uji koneksi".

## Sebelum membagikan ke penguji

- Buat repo untuk file tombol mati dan isi `REMOTE_CONFIG_URL`.
- Lengkapi `docs/PASANG.md` dengan screenshot.
- Baca `docs/ATURAN-REQUEST.md` bagian batas uji coba: maksimal 10 orang, masing-masing dengan akunnya sendiri di browsernya sendiri.
- Pastikan minimal satu penguji punya mata kuliah yang sedang berjalan.
