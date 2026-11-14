# Fixtures

Folder ini hanya boleh berisi data yang sudah disanitasi sesuai `docs/TESTING.md`.

Jangan pernah menaruh respons mentah dari SIKOLA di sini, walau hanya sementara. Berkas mentah untuk keperluan lokal ditaruh di `fixtures/raw/`, yang sudah diabaikan git dan diblokir dari Claude Code lewat `.claude/settings.json`.

| Folder | Isi |
|---|---|
| `synthetic/` | Dibuat tangan, bentuknya mengikuti `docs/API-MOODLE.md`. Dipakai test skema sampai fixture rekaman tersedia |
| `recorded/` | Hasil perekam fixture di build dev (sudah tersanitasi saat disimpan). Berkasnya `*.recorded.json` |

Penamaan: `{fungsi-atau-halaman}.{kasus}.json` atau `.html`, misalnya `calendar-action-events.normal.json`, `courseformat-state.hidden-item.json`, `login-page.html`.

Cara merekam: jalankan `pnpm dev`, buka SIKOLA dan login, lalu buka `chrome-extension://<id>/recorder.html` dan tekan "Rekam fixture". Pindahkan berkas dari folder Unduhan ke `fixtures/recorded/`, lalu jalankan `node scripts/check-leaks.mjs`.
