# Fixtures

Folder ini hanya boleh berisi data yang sudah disanitasi (lihat bagian "Data rules" di `CONTRIBUTING.md`).

Jangan pernah menaruh respons mentah dari SIKOLA di sini, walau hanya sementara. Berkas mentah untuk keperluan lokal ditaruh di `fixtures/raw/`, yang sudah diabaikan git.

| Folder | Isi |
|---|---|
| `synthetic/` | Dibuat tangan, bentuknya mengikuti field SIKOLA yang sudah diverifikasi. Dipakai test skema sampai fixture rekaman tersedia |
| `recorded/` | Hasil perekam fixture di build dev (sudah tersanitasi saat disimpan). Berkasnya `*.recorded.json` |

Penamaan: `{fungsi-atau-halaman}.{kasus}.json` atau `.html`, misalnya `calendar-action-events.normal.json`, `courseformat-state.hidden-item.json`, `login-page.html`.

Cara merekam (memakai 2 request dari anggaran harian):

1. `pnpm build:dev`, lalu di `chrome://extensions` muat `.output/chrome-mv3-dev` lewat "Load unpacked" di profil Chrome yang sudah login ke SIKOLA. Matikan dulu build produksi kalau terpasang, supaya tidak ada dua Sulo. (`pnpm dev` tidak cocok untuk ini karena membuka profil Chrome baru yang belum login.)
2. Buka satu halaman SIKOLA supaya sesskey terdeteksi.
3. Buka `chrome-extension://<id>/recorder.html` (id terlihat di kartu ekstensi), tekan "Rekam fixture".
4. Pindahkan berkas `*.recorded.json` dari folder Unduhan ke `fixtures/recorded/`, lalu jalankan `node scripts/check-leaks.mjs`.
