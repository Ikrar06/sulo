# Glosarium tulisan Sulo

Pengguna Sulo adalah mahasiswa, bukan programmer. Semua teks di `lib/i18n/id.ts` mengikuti daftar ini.

## Gaya

- Seperti teman yang rapi: santai, sopan, kalimat pendek, kata sehari-hari. Sapa dengan "kamu".
- Satu ide per kalimat. Kalau cukup lima kata, jangan pakai dua belas.
- Tanpa istilah teknis, tanpa tanda seru, tanpa bahasa alay, tanpa emoji.
- Huruf kapital hanya di awal kalimat dan nama. Tidak ada judul atau label yang ditulis kapital semua.
- Pesan masalah menyebut apa yang terjadi dan apa yang bisa dilakukan. Tidak meminta maaf, tidak samar.
- Nama tombol sama dengan hasilnya. Tombol "Lanjut" membawa ke langkah berikutnya, "Buka SIKOLA" membuka SIKOLA.
- Angka ditulis dengan angka ("3 tugas"), dan satuan waktu ditulis lengkap ("2 menit", "5 jam", "3 hari").

## Kata

| Hindari | Pakai |
|---|---|
| sinkron, sinkronisasi | perbarui, diperbarui |
| Sinkron 2 mnt lalu | Diperbarui 2 menit lalu |
| sesi habis, sesi kedaluwarsa | Masuk ke SIKOLA lagi supaya Sulo bisa memperbarui tugasmu |
| parser rusak, respons tidak dikenali | Sulo belum bisa membaca SIKOLA dengan benar. Coba lagi nanti |
| batas harian tercapai, anggaran request, backoff | Tidak pernah ditampilkan (M5a.4). Data lebih dari 12 jam: "Sulo belum bisa memperbarui sejak {waktu}. Coba Perbarui nanti." |
| data basi | Terakhir diperbarui 7 jam lalu |
| offline, tidak terhubung ke jaringan | Kamu sedang offline. Menampilkan data terakhir |
| sakelar, toggle, aktifkan, nonaktifkan | pilih, centang, hapus centang |
| usulan Sulo, pin manual, skor | (jangan disebut ke pengguna) |
| course | mata kuliah |
| sesskey, request, server, sync | (jangan disebut ke pengguna) |
| Tidak resmi, tidak berafiliasi dengan Unhas | Bukan aplikasi resmi Unhas |
| Kebijakan privasi (di footer) | Privasi |
| dinonaktifkan dari jarak jauh | Sulo sedang istirahat sebentar |

## Baris status di popup

- Masalah ditampilkan sebagai satu baris status di bawah judul: ikon kecil, kalimat, lalu aksi kalau ada ("Buka SIKOLA", "Perbarui", "Salin info").
- Kalimatnya tetap mengikuti daftar kata di atas. Ekspresi maskot sudah menunjukkan suasananya, jadi kalimat tidak perlu dramatis.

## Pernyataan tidak resmi

- Kalimat lengkap "Sulo bukan aplikasi resmi dan tidak berafiliasi dengan Universitas Hasanuddin" muncul di langkah 1 pengaturan awal dan di halaman privasi.
- Di footer popup dan halaman lain cukup "Bukan aplikasi resmi Unhas" dengan tautan "Privasi".
- Pernyataan ini muncul sekali per layar, tidak diulang.

## Notifikasi

| Jenis | Judul | Isi |
|---|---|---|
| Tugas | Laporan praktikum, 3 jam lagi | Fisika Dasar. Tenggat Kamis 23.59. |
| Ringkasan | 3 tugas mendekati tenggat | Yang terdekat: Laporan praktikum, 5 jam lagi. |
| Ringkasan pagi | Tugasmu hari ini | 1 tugas hari ini, 3 minggu ini. Yang terdekat: ... |
| SIKOLA meminta masuk lagi (baris status: "SIKOLA memintamu masuk lagi. Data di bawah dari ...") | Tugasmu belum bisa diperbarui | Masuk ke SIKOLA lagi supaya Sulo bisa memperbarui tugasmu. |
| Uji | Notifikasi uji dari Sulo | Kalau kamu melihat ini, pengingat Sulo akan muncul. |

- Tombol: "Tunda 1 jam", "Tandai selesai". Di popup: "Tunda pengingat", "Besok pagi, 07.00", "Batalkan tunda".
- Pengaturan memakai kotak centang dan kalimat biasa ("Ingatkan aku sebelum tenggat", "Jangan ganggu pada jam tertentu"). Hindari "sakelar", "toggle", "aktifkan".
- Notifikasi tidak pernah memuat nilai atau data sensitif lain.

## Kabar terbaru

| Kabar | Judul notifikasi |
|---|---|
| Materi baru | 3 materi baru di Hidrologi |
| Tugas baru | Tugas baru di Hidrologi |
| Tenggat berubah | Tenggat Laporan praktikum diundur 2 hari / dimajukan 1 hari |
| Nilai atau feedback | Ada nilai atau feedback baru di Analisa Struktur I |
| Forum | Kabar baru di forum Hidrologi |
| Ringkasan | 9 kabar baru dari 5 mata kuliah |

- Pakai "diundur" dan "dimajukan", bukan "mundur" atau "maju".
- Notifikasi nilai tidak pernah menyebut angka nilai atau isi komentar.
- Panel: "Kabar terbaru", "3 kabar baru", "Tandai semua sudah dilihat", "Beri tahu aku tentang". Penanda baris: "Baru", "Tenggat berubah".

## Akun dan data

| Keadaan | Tulisan |
|---|---|
| Akun lain masuk ke SIKOLA | Judul "Akun SIKOLA berganti". Tombol "Pakai akun ini" dan "Nanti, aku akan masuk dengan akun sebelumnya" |
| Setelah "Nanti" | "Tugas akun sebelumnya disembunyikan" + "Masuk lagi ke SIKOLA dengan akun sebelumnya, lalu klik Perbarui." |
| Hapus semua data | Judul "Hapus semua data Sulo?", tombol "Hapus semua data" dan "Batal" |
| Atur mata kuliah | Judul "Mata kuliahmu", tombol "Segarkan daftar" dan "Simpan", lalu "Tidak ada perubahan" atau "Tersimpan" dengan "Kembali ke Sulo" |

- Sebut apa yang terjadi pada data dengan kata sehari-hari: "disembunyikan", "dihapus", "tidak tersentuh". Jangan menyebut userid, storage, atau akun "aktif".
- Setiap kalimat tentang penghapusan menyebut bahwa data di SIKOLA tidak tersentuh.

## Dashboard dan kalender

- Halaman dashboard: Ringkasan, Tugas, Mata kuliah, Kabar terbaru, Kalender, Pengaturan, Bantuan, Tentang.
- "Tenggat pribadi" untuk tenggat yang dibuat pengguna; tidak pernah mengubah SIKOLA.
- "Tanggal penting", "Minggu ke-14 dari 16", "Minggu belum tersedia", "14 hari lagi", "Sampai 12 Feb".
- Tanda kalender: "Perkiraan bulan", "Tanpa tanggal akhir", "Perlu dicek". Setiap tampilan kalender menutup dengan "Rujuk dokumen resmi".
- "Traktir kopi" dengan keterangan "lewat Trakteer". "Statistik pemakaian (lokal)" dan "Ekspor statistik".

## M6: istilah yang disatukan

| Hal | Istilah |
|---|---|
| mata kuliah yang diikuti Sulo | dipantau / tidak dipantau (bukan "aktif") |
| mengecek SIKOLA sekarang | Perbarui |
| mengambil ulang daftar mata kuliah | Muat ulang daftar (bukan "Segarkan daftar") |
| log perubahan | Kabar terbaru |
| empty state | satu kalimat: apa yang akan muncul di sini |
