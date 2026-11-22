<!--
Template for the notes of every GitHub Release that carries an Android APK.
The first line is required as it is: Android has no store listing, so the
release notes and the README are where the unofficial statement lives.
Keep the notes in the user's words; the commit list does not belong here.
-->

Bukan aplikasi resmi Unhas. Sulo tidak resmi dan tidak berafiliasi dengan Universitas Hasanuddin.
(Not an official Unhas app. Sulo is unofficial and not affiliated with Universitas Hasanuddin.)

## Yang baru di Sulo <versi> / What's new

- ...

## Sebelum memasang / Before you install

1. Cocokkan SHA-256 berkas dengan `sulo-<versi>-android.apk.sha256` di halaman ini:
   `shasum -a 256 sulo-<versi>-android.apk`
   (Windows: `certutil -hashfile sulo-<versi>-android.apk SHA256`)
2. Kalau punya Android SDK: `apksigner verify --print-certs sulo-<versi>-android.apk`. Baris "certificate SHA-256 digest" harus sama persis dengan yang tertulis di README (bagian Android). APK dengan sidik jari lain bukan dari proyek ini.

The APK's SHA-256 must match the `.sha256` file on this page, and the "certificate SHA-256 digest" that `apksigner verify --print-certs` prints must be exactly the one given in the README.

## Catatan / Notes

- Memperbarui dari versi sebelumnya tidak menghapus datamu. / Updating keeps your data.
- Masalah atau saran: buka issue lewat formulir laporan bug, tanpa data pribadi. / Problems or ideas: open an issue with the bug report form, without personal data.
