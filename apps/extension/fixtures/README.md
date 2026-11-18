# Fixtures

Folder ini hanya berisi data buatan. Fixture dari akun nyata tidak pernah masuk repo, walau sudah disanitasi. Lihat bagian "Data rules" di `CONTRIBUTING.md`.

| Folder | Isi |
|---|---|
| `synthetic/` | Fixture buatan tangan. Nama field, tipe nilai, dan bentuk objeknya sama persis dengan respons SIKOLA yang sudah direkam, tetapi isinya karangan dan jumlah course serta aktivitasnya berbeda. Semua test skema memakai folder ini, dan CI memvalidasi setiap berkas di sini |
| `raw/` | Tidak pernah ada di repo (diabaikan git). Untuk data lokal saja |

Kasus yang sengaja ada di fixture sintetis:

- course dengan label tanpa `url` (`cm.url` opsional)
- bagian dengan `current: true` (ditandai dosen sebagai yang sedang berjalan)
- event kalender `quiz/close` (Sulo hanya membaca tenggat quiz, tidak pernah isinya)
- notifikasi dari `mod_assign`, `gradingform`, dan `mod_forum`, selain `moodle/newlogin`. Nilai `component` dan `eventtype` untuk nilai, feedback, dan forum masih perkiraan sampai ada contoh nyata

Penamaan: `{fungsi-atau-halaman}.{kasus}.json` atau `.html`, misalnya `calendar-action-events.normal.json`, `courseformat-state.hidden-item.json`, `login-page.html`.

## Menjaga bentuk tetap sama dengan aslinya

Pengelola menyimpan rekaman tersanitasi dari akun penguji secara lokal, di luar git. `node scripts/compare-fixture-shapes.mjs` (atau `pnpm fixtures:compare`) membandingkan bentuk fixture sintetis dengan rekaman itu: hanya jalur field dan tipe, tanpa nilai. Skrip ini otomatis dilewati kalau rekamannya tidak ada, misalnya di CI.

## Merekam (khusus pengelola)

Perekam hanya untuk memperbarui bentuk acuan. Hasilnya tidak di-commit. Satu rekaman memakai 2 request dari anggaran harian.

1. `pnpm build:dev`, lalu di `chrome://extensions` muat `.output/chrome-mv3-dev` lewat "Load unpacked" di profil Chrome yang sudah login ke SIKOLA. Matikan dulu build produksi kalau terpasang, supaya tidak ada dua Sulo. (`pnpm dev` tidak cocok untuk ini karena membuka profil Chrome baru yang belum login.)
2. Buka satu halaman SIKOLA supaya sesskey terdeteksi.
3. Buka `chrome-extension://<id>/recorder.html` (id terlihat di kartu ekstensi), tekan "Rekam fixture".
4. Simpan berkas `*.recorded.json` di tempat lokal yang diabaikan git, lalu jalankan `pnpm fixtures:compare`.
