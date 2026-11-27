// The user guide's words (/panduan/): what Sulo is for, how it connects to
// SIKOLA and NEOSIA, and every feature of the extension and of the Android
// app, each beside the app's own screen. Indonesian here; English in
// pakai-en.ts, the same shape. The facts follow the apps' own help
// (packages/core/src/help) and their words (packages/core/src/i18n): a
// number or a name that changes there changes here. The landing's rule
// holds: no separator characters between phrases.
import type { LayarDasbor, LayarHpNama } from '../layar/dasbor';

export type GambarPakai = ({ jenis: 'dasbor'; nama: LayarDasbor } | { jenis: 'hp'; nama: LayarHpNama } | { jenis: 'popup' }) & {
  /** What the picture shows: its caption, and its name for a screen reader. */
  ket: string;
};

export interface BagianPakai {
  id: string;
  /** At most six words (the landing's budget for a section title). */
  judul: string;
  isi: readonly string[];
  /** "What you can do here", one action a line. */
  bisa?: readonly string[];
  gambar?: readonly GambarPakai[];
  /** One note that matters, in a quiet box. */
  catatan?: string;
  /** The phone guide only (one guide for Android and iPhone, 1.1.0): what differs on the iPhone, in its own box. */
  iphone?: string;
}

export interface HalamanPakai {
  nama: string;
  judul: string;
  kenapa: string;
  deskripsi: string;
  bagian: readonly BagianPakai[];
}

export interface KataPakai {
  remah: string;
  beranda: string;
  panduan: string;
  /** The footer's link: long enough to be a touch target by itself. */
  kaki: string;
  isiHalaman: string;
  dataContoh: string;
  /** Under a dashboard screen on a phone, where it is drawn small: opens the screen itself, which can be zoomed. */
  perbesar: string;
  lain: string;
  belumPasang: string;
  caraPasang: string;
  /** The home page's block that leads here, after the features. */
  arah: { judul: string; isi: string; mulai: { nama: string; isi: string } };
  bantuanTitle: string;
  bantuanIsi: string;
  kirimMasukan: string;
  indeks: {
    judul: string;
    kenapa: string;
    deskripsi: string;
    fungsi: { judul: string; isi: readonly string[]; gambar: readonly [GambarPakai, GambarPakai] };
    sumber: { judul: string; isi: string; daftar: readonly { nama: string; label: string; isi: string; dapat: readonly string[] }[] };
    tidak: { judul: string; daftar: readonly string[] };
    sikola: { judul: string; isi: string; ekstensi: { nama: string; langkah: readonly string[] }; android: { nama: string; langkah: readonly string[] }; catatan: string };
    neosia: { judul: string; isi: readonly string[]; ekstensi: { nama: string; langkah: readonly string[] }; android: { nama: string; langkah: readonly string[] }; catatan: string };
    pilih: { judul: string; isi: string; ekstensi: { nama: string; isi: string }; android: { nama: string; isi: string } };
  };
  ekstensi: HalamanPakai;
  android: HalamanPakai;
}

export const pakaiId: KataPakai = {
  remah: 'Kamu di sini',
  beranda: 'Beranda',
  panduan: 'Panduan',
  kaki: 'Panduan pakai',
  isiHalaman: 'Di halaman ini',
  dataContoh: 'Semua layar di panduan ini digambar dari aplikasinya sendiri, dengan data contoh.',
  perbesar: 'Lihat lebih besar',
  lain: 'Panduan lain',
  belumPasang: 'Belum memasang Sulo?',
  caraPasang: 'Lihat cara pasang',
  arah: {
    judul: 'Mau tahu cara pakainya?',
    isi: 'Tiap halaman dijelaskan satu per satu, lengkap dengan layarnya: tugas, presensi, kalender, sampai cara menghubungkan SIKOLA dan NEOSIA.',
    mulai: { nama: 'Sulo itu untuk apa', isi: 'Fungsinya, dari mana datanya, dan cara menghubungkan SIKOLA dan NEOSIA.' },
  },
  bantuanTitle: 'Masih bingung?',
  bantuanIsi: 'Tulis pertanyaanmu lewat formulir masukan. Jangan kirim NIM, password, atau nilai.',
  kirimMasukan: 'Kirim masukan',
  indeks: {
    judul: 'Panduan Sulo.',
    kenapa: 'Sulo itu untuk apa, bagaimana ia terhubung ke SIKOLA dan NEOSIA, dan apa saja yang bisa kamu lakukan di tiap halamannya.',
    deskripsi: 'Panduan lengkap Sulo: fungsinya, cara menghubungkan SIKOLA dan NEOSIA, dan tiap fitur di ekstensi browser dan aplikasi Android.',
    fungsi: {
      judul: 'Sulo itu untuk apa',
      isi: [
        'Urusan kuliah di Unhas tersebar: tugas dan presensi di SIKOLA, jadwal, KRS, dan nilai di NEOSIA, tanggal ujian di PDF kalender akademik.',
        'Sulo membacanya dari akunmu sendiri dan menampilkannya di satu tempat: semua tugas urut tenggat, kabar saat ada materi baru atau tenggat berubah, presensi, dan kalender akademik. Sebelum tenggat lewat, Sulo mengingatkanmu.',
        'Sulo hanya menampilkan dan mengingatkan. Tugas tetap dikumpulkan di SIKOLA, KRS tetap diisi di NEOSIA.',
      ],
      gambar: [
        { jenis: 'dasbor', nama: 'ringkasan', ket: 'Ekstensi di laptop: dashboard Sulo, halaman Ringkasan.' },
        { jenis: 'hp', nama: 'ringkasan', ket: 'Aplikasi HP: layar Ringkasan.' },
      ],
    },
    sumber: {
      judul: 'Dari mana datanya',
      isi: 'Empat sumber. Semuanya dibaca dari akunmu dan disimpan di perangkatmu saja.',
      daftar: [
        { nama: 'SIKOLA', label: 'Wajib', isi: 'Inti Sulo. Terhubung lewat sesi SIKOLA-mu, tanpa password.', dapat: ['Tugas dan tenggatnya', 'Materi, tugas, dan pengumuman baru', 'Perubahan tenggat', 'Rekap dan rincian presensi'] },
        { nama: 'Kalender akademik Unhas', label: 'Otomatis', isi: 'Dari kalender resmi (SK Rektor). Tidak perlu masuk ke mana pun.', dapat: ['Jadwal KRS dan pembayaran UKT', 'Masa kuliah, UTS, dan UAS', 'Libur nasional dan libur semester', 'Wisuda dan KKN'] },
        { nama: 'NEOSIA', label: 'Opsional', isi: 'Baru aktif kalau kamu nyalakan. Sulo hanya membaca halaman NEOSIA yang kamu buka sendiri.', dapat: ['Jadwal kuliah mingguan', 'Kesiapan KRS', 'Nilai, IPS, dan IPK', 'SKS lulus dan sisa masa studi'] },
        { nama: 'Sipakamase', label: 'Opsional', isi: 'Baru aktif kalau kamu hubungkan. Kamu masuk di Sipakamase sendiri; Sulo hanya membaca lima halaman MKPK-mu.', dapat: ['SKS kegiatan MKPK yang belum dikonversi', 'MKPK lulus yang belum masuk NEOSIA', 'Pengingat sebelum batas penginputan nilai', 'Kabar saat status kegiatan berubah'] },
      ],
    },
    tidak: {
      judul: 'Yang tidak Sulo lakukan',
      daftar: [
        'Tidak meminta, membaca, atau menyimpan password SIKOLA, NEOSIA, maupun Sipakamase.',
        'Tidak mengubah apa pun di SIKOLA, NEOSIA, atau Sipakamase. Sulo hanya membaca.',
        'Tidak mengumpulkan tugas, tidak mengisi KRS, survei, atau presensi.',
        'Tidak mengirim datamu ke server mana pun. Tidak ada iklan dan pelacakan.',
        'Bukan aplikasi resmi Unhas. Untuk hal penting, tetap cek SIKOLA, NEOSIA, dan dokumen resmi kampus.',
      ],
    },
    sikola: {
      judul: 'Menghubungkan ke SIKOLA',
      isi: 'Sulo tidak punya halaman login. Kamu masuk di halaman SIKOLA yang asli, dan Sulo memakai sesi itu.',
      ekstensi: {
        nama: 'Di ekstensi (Chrome atau Edge)',
        langkah: [
          'Setelah dipasang, Sulo membuka halaman perkenalan. Klik Buka SIKOLA.',
          'Masuk ke SIKOLA seperti biasa di tab itu. Sulo langsung mengenalinya.',
          'Pilih mata kuliah yang mau dipantau. Yang sedang berjalan sudah dicentang.',
          'Sulo mengambil tugas, mata kuliah, dan presensimu. Selesai.',
        ],
      },
      android: {
        nama: 'Di aplikasi HP',
        langkah: [
          'Buka Sulo, lalu ketuk Masuk ke SIKOLA.',
          'Halaman login SIKOLA terbuka di dalam aplikasi. Masuk seperti biasa: password-mu diketik di halaman SIKOLA, bukan di Sulo.',
          'Pilih mata kuliah yang mau dipantau dan apakah kamu mau diingatkan.',
          'Sulo mengambil tugas, mata kuliah, dan presensimu. Selesai.',
        ],
      },
      catatan: 'Sesi SIKOLA punya batas waktu. Kalau Sulo menulis "Masuk lagi ke SIKOLA", masuk lagi dengan cara yang sama. Data terakhir tetap tampil.',
    },
    neosia: {
      judul: 'Menghubungkan NEOSIA',
      isi: [
        'Tambahan, baru aktif kalau kamu nyalakan. Isinya jadwal kuliah, kesiapan KRS, dan nilai.',
        'Sulo tidak pernah menghubungi NEOSIA. Ia hanya menyalin dari halaman NEOSIA yang sedang kamu buka, dan membuang data pribadi seperti NIM, alamat, kontak, dan nominal pembayaran.',
      ],
      ekstensi: {
        nama: 'Di ekstensi (Chrome atau Edge)',
        langkah: [
          'Buka dashboard, lalu Pengaturan, bagian NEOSIA. Nyalakan Hubungkan NEOSIA.',
          'Baca apa yang disimpan dan apa yang dibuang, lalu pilih Hubungkan. Browser menanyakan izin untuk halaman NEOSIA.',
          'Sulo membuka beranda NEOSIA. Masuk di sana kalau diminta.',
          'Buka Beranda dan Kartu Hasil Studi sekali. Datanya masuk saat halaman itu terbuka.',
        ],
      },
      android: {
        nama: 'Di aplikasi HP',
        langkah: [
          'Di Ringkasan, ketuk Hubungkan pada ajakan NEOSIA. Bisa juga dari Lainnya, Pengaturan, NEOSIA.',
          'Ketuk Masuk NEOSIA, lalu masuk di halaman NEOSIA sendiri. Biasanya cukup sekali.',
          'Buka halaman yang diminta daftar "Lengkapi data dari NEOSIA", misalnya Beranda dan Kartu Hasil Studi.',
          'Untuk data terbaru, ketuk Perbarui dari NEOSIA. Sulo hanya membuka halaman NEOSIA itu.',
        ],
      },
      catatan: 'Nilai dan IPK tersembunyi sampai kamu memilih Tampilkan nilai. Putuskan NEOSIA kapan saja, dan semua datanya di Sulo ikut terhapus.',
    },
    pilih: {
      judul: 'Panduan tiap fitur',
      isi: 'Fiturnya sama, tata letaknya berbeda. Pilih yang kamu pakai.',
      ekstensi: { nama: 'Ekstensi di laptop', isi: 'Popup, dashboard, tugas, presensi, kabar, kalender, pengingat, dan NEOSIA.' },
      android: { nama: 'Aplikasi Android dan iPhone', isi: 'Ringkasan, tugas, kalender, presensi, pantau tugas baru, pengingat, dan NEOSIA.' },
    },
  },
  ekstensi: {
    nama: 'Ekstensi',
    judul: 'Panduan ekstensi Sulo.',
    kenapa: 'Semua yang bisa kamu lakukan di ekstensi Chrome dan Edge, dari popup sampai NEOSIA.',
    deskripsi: 'Panduan lengkap ekstensi Sulo untuk Chrome dan Edge: popup, dashboard, tugas, presensi, kabar terbaru, kalender akademik, pengingat, dan NEOSIA.',
    bagian: [
      {
        id: 'popup',
        judul: 'Popup, pintu masuknya',
        isi: [
          'Klik ikon Sulo di kanan atas browser untuk membuka popup. Supaya ikonnya selalu terlihat, klik ikon puzzle di kanan atas browser lalu sematkan Sulo.',
          'Popup menampilkan tugas yang paling dekat tenggatnya, dikelompokkan jadi Terlambat, Hari ini dan besok, Minggu ini, dan Nanti. Di kanan atasnya ada tiga ikon: Perbarui, Salin daftar, dan Pengaturan (roda gigi).',
        ],
        bisa: [
          'Membuka dashboard: klik ikon roda gigi, lalu pilih Buka dashboard.',
          'Klik ikon Perbarui untuk mengecek SIKOLA saat itu juga.',
          'Klik sebuah tugas untuk membukanya di SIKOLA.',
          'Menu tiga titik di tiap tugas: Tandai selesai, Tunda pengingat, atau Tambah ke Google Kalender.',
          'Klik ikon Salin daftar untuk menyalin tugas minggu ini, atau semua yang belum dikumpulkan, lalu tempel ke grup kelas.',
          'Dari ikon roda gigi juga: format waktu tenggat, bahasa, pengingat, dan atur mata kuliah.',
          'Melihat kabar terbaru dan tanggal penting kalender akademik yang terdekat.',
        ],
        gambar: [{ jenis: 'popup', ket: 'Popup Sulo: tugas terdekat. Ikon roda gigi di kanan atas membuka Pengaturan dan dashboard.' }],
        catatan: 'Hampir semua fitur ada di dashboard, dan dashboard dibuka dari popup: ikon roda gigi di kanan atas, lalu Buka dashboard. Halaman itu bisa kamu jadikan bookmark supaya cepat dibuka lagi.',
      },
      {
        id: 'ringkasan',
        judul: 'Ringkasan',
        isi: ['Halaman pertama dashboard. Satu layar untuk tahu keadaan minggu ini tanpa membuka apa pun.'],
        bisa: [
          'Membaca ringkasan di samping maskot: jumlah tenggat minggu ini, tugas terlambat, dan berapa hari lagi ke UAS.',
          'Melihat tugas untuk Hari ini, Besok, dan Minggu ini, lalu mencentang yang sudah selesai.',
          'Melihat kegiatan kalender akademik berikutnya dan sekarang minggu kuliah ke berapa.',
          'Membaca Beban 14 hari ke depan: makin pekat warnanya, makin banyak tenggat hari itu. Hari ujian selalu ditandai.',
          'Melihat kabar terbaru dan rata-rata presensimu.',
        ],
        gambar: [{ jenis: 'dasbor', nama: 'ringkasan', ket: 'Ringkasan di dashboard: tugas, kalender akademik, dan menu halaman di kiri.' }],
      },
      {
        id: 'tugas',
        judul: 'Tugas',
        isi: [
          'Semua tugas dari mata kuliah yang kamu pantau, diurutkan menurut tenggat. Tugas diambil dari kalender SIKOLA sampai 90 hari ke depan.',
          'Klik sebuah tugas untuk membuka rinciannya. Semua yang kamu tulis di rincian hanya tersimpan di browsermu.',
        ],
        bisa: [
          'Mencari tugas atau mata kuliah, dan menyaring menurut mata kuliah.',
          'Menyaring menurut status: Belum selesai, Sudah dinilai, Ditandai selesai, Mungkin sudah dikumpulkan, Sudah lama lewat, Mata kuliah tidak dipantau, atau Semua.',
          'Melihat tugas yang sudah dinilai di SIKOLA. Tugas yang dinilai otomatis ditandai selesai, dan angkanya tersembunyi sampai kamu memilih Tampilkan nilai.',
          'Menambah tugas sendiri lewat Tambah tugas di kanan atas, untuk tugas dari dosen yang tidak ada di SIKOLA.',
          'Memecah tugas jadi langkah kecil dan mencentangnya satu per satu.',
          'Menulis catatan untuk dirimu sendiri.',
          'Memasang tenggat pribadi untuk tugas yang tidak diberi tenggat di SIKOLA, supaya tetap diingatkan.',
          'Menunda pengingat 1 jam, 3 jam, atau sampai besok pagi.',
          'Membuka tugas di SIKOLA, menambahkannya ke Google Kalender, atau mengunduhnya sebagai berkas .ics untuk Kalender Mac dan Outlook.',
          'Menandai selesai, dan mengurungkannya kalau salah klik.',
        ],
        gambar: [
          { jenis: 'dasbor', nama: 'tugas', ket: 'Halaman Tugas: pencarian, saringan mata kuliah, dan saringan status.' },
          { jenis: 'dasbor', nama: 'tugas-rincian', ket: 'Rincian satu tugas: langkah, catatan, dan tombol aksinya.' },
        ],
        catatan: 'Tandai selesai hanya menandai di Sulo supaya pengingatnya berhenti. Mengumpulkan tugas tetap dilakukan di SIKOLA.',
      },
      {
        id: 'mata-kuliah',
        judul: 'Mata kuliah',
        isi: ['Tugas, kabar, dan presensi hanya diambil dari mata kuliah yang dipantau. Di sini kamu mengaturnya.'],
        bisa: [
          'Menyalakan atau mematikan pemantauan tiap mata kuliah dengan tombol di kanannya.',
          'Mengganti nama tampilan. Kosongkan untuk kembali ke nama dari SIKOLA.',
          'Mengganti warna mata kuliah. Warna itu dipakai di semua halaman.',
          'Klik Muat ulang daftar kalau mata kuliah baru belum muncul.',
        ],
        gambar: [{ jenis: 'dasbor', nama: 'mata-kuliah', ket: 'Halaman Mata kuliah: titik warna, nama, dan tombol Dipantau.' }],
      },
      {
        id: 'presensi',
        judul: 'Presensi',
        isi: ['Rekap kehadiranmu dari SIKOLA. Diperbarui otomatis sekali sehari, dan rincian tiap pertemuan diambil saat kamu membukanya.'],
        bisa: [
          'Melihat persentase, jumlah sesi tercatat, dan poin tiap mata kuliah.',
          'Melihat rata-rata presensi dan mata kuliah dengan persentase terendah.',
          'Klik sebuah mata kuliah untuk melihat status tiap sesi: Hadir, Terlambat, Izin, atau Alpa, beserta keterangannya.',
          'Klik Perbarui untuk mengambil data terbaru, paling sering tiap 2 menit.',
        ],
        gambar: [
          { jenis: 'dasbor', nama: 'presensi', ket: 'Halaman Presensi: persentase tiap mata kuliah.' },
          { jenis: 'dasbor', nama: 'presensi-rincian', ket: 'Rincian presensi satu mata kuliah: status tiap pertemuan.' },
        ],
        catatan: 'Sulo hanya membaca presensi. Mengisi presensi tetap dilakukan di SIKOLA.',
      },
      {
        id: 'kabar',
        judul: 'Kabar terbaru',
        isi: [
          'Sulo mencatat apa yang berubah di mata kuliahmu: materi baru, tugas baru, tenggat yang digeser, nilai atau feedback baru, dan forum serta pengumuman.',
          'Isi mata kuliah dicek paling sering 6 jam sekali, jadi sebuah kabar bisa muncul beberapa jam setelah dosen mengunggahnya.',
        ],
        bisa: [
          'Menyaring kabar menurut mata kuliah dan jenisnya.',
          'Klik sebuah kabar untuk membukanya di SIKOLA.',
          'Klik Atur notifikasi untuk memilih jenis kabar yang dikirim sebagai notifikasi.',
          'Menandai semua kabar sudah dilihat.',
        ],
        gambar: [{ jenis: 'dasbor', nama: 'kabar', ket: 'Halaman Kabar terbaru: tugas baru, tenggat berubah, dan materi baru.' }],
      },
      {
        id: 'kalender',
        judul: 'Kalender akademik',
        isi: [
          'Kalender akademik Unhas dan tenggat tugasmu di satu kalender. Tiap kegiatan menyebut sumbernya dan menautkan PDF resminya.',
        ],
        bisa: [
          'Berpindah antara tampilan Bulan dan Daftar.',
          'Klik kategori (Akademik, Ujian, Administrasi, Libur, Wisuda, Tugas) untuk menyembunyikan atau menampilkannya.',
          'Klik sebuah tanggal untuk melihat kegiatan dan tenggat di hari itu.',
          'Melihat sekarang minggu kuliah ke berapa dan berapa hari lagi ke UAS.',
          'Menambahkan kalender umum (Inti S1, Wisuda, Libur nasional) ke Google Kalender, Outlook, atau Apple, supaya muncul juga di HP.',
          'Klik ikon lonceng untuk mengatur notifikasi KRS, UKT, UTS, UAS, dan batas lainnya.',
        ],
        gambar: [{ jenis: 'dasbor', nama: 'kalender', ket: 'Halaman Kalender: tampilan bulan, kategori, dan kegiatan yang akan datang.' }],
        catatan: 'Kalender langganan hanya berisi tanggal akademik umum, tanpa data pribadimu. Google Kalender memperbaruinya dengan jadwalnya sendiri, bisa sampai sehari.',
      },
      {
        id: 'pengingat',
        judul: 'Pengingat dan notifikasi',
        isi: [
          'Notifikasi browser sebelum tenggat. Atur di dashboard, Pengaturan, bagian Pengingat tugas.',
        ],
        bisa: [
          'Memilih kapan diingatkan, dari 3 hari sampai 1 jam sebelum tenggat.',
          'Memasang jam tenang (bawaan 22.00 sampai 06.00). Pengingat terakhir sebelum tenggat tetap bisa lewat.',
          'Menyalakan ringkasan pagi: satu notifikasi berisi tugas hari itu, pada jam yang kamu pilih.',
          'Dari notifikasinya langsung: Tunda atau Tandai selesai.',
          'Memilih jenis kabar yang diberitahukan: materi dan tugas baru, perubahan tenggat, nilai dan feedback, forum dan pengumuman.',
          'Memilih tanggal kalender akademik yang diingatkan: KRS, UKT, UTS, UAS, dan batas lainnya.',
          'Klik Kirim notifikasi uji untuk memastikan notifikasinya muncul.',
        ],
        gambar: [{ jenis: 'dasbor', nama: 'pengaturan-pengingat', ket: 'Pengaturan pengingat: kapan diingatkan, jam tenang, dan ringkasan pagi.' }],
        catatan: 'Kalau notifikasi uji tidak muncul, nyalakan notifikasi untuk Chrome atau Edge di pengaturan sistem komputermu. Di macOS, tombol Tunda dan Tandai selesai ada di balik tombol Opsi pada notifikasi.',
      },
      {
        id: 'neosia',
        judul: 'NEOSIA: jadwal, KRS, nilai',
        isi: [
          'Tambahan, baru aktif kalau kamu nyalakan di Pengaturan, bagian NEOSIA. Setelah terhubung, menu di kiri bertambah Jadwal dan Nilai.',
          'Datanya masuk saat kamu membuka halaman NEOSIA sendiri: Beranda, Kartu Hasil Studi, dan KRS. Untuk memperbarui, buka lagi halaman itu.',
        ],
        bisa: [
          'Ringkasan: melihat kuliah hari ini lengkap dengan jam dan ruangnya, paling atas di kartu Tugas.',
          'Ringkasan: membaca Kesiapan KRS, yaitu kapan pengisian dibuka, status pembayaran, survei, sisa kuota SKS, status KRS, dan dosen PA.',
          'Ringkasan: melihat kartu Studi berisi SKS lulus dan IPK. IPK tersembunyi sampai kamu memilih Tampilkan.',
          'Jadwal: melihat jadwal kuliah per pekan, lalu klik sebuah kelas untuk melihat dosen dan ruangnya.',
          'Jadwal: mengunduh berkas kalender untuk dimasukkan ke Google Kalender. Hari libur dan minggu UTS sudah dilewati.',
          'Mata kuliah: menghubungkan kelas NEOSIA ke mata kuliah SIKOLA yang sama, supaya nama dan warnanya ikut.',
          'Nilai: melihat IPK resmi dari NEOSIA, SKS lulus, sisa masa studi, grafik IPS tiap semester, dan transkrip per semester.',
          'Nilai: melihat daftar mata kuliah yang bisa diperbaiki, dan mencoba Simulasi IPK.',
          'Pengaturan: menyalakan mode privasi untuk menyamarkan nama, nilai, IPK, dan persentase presensi, misalnya sebelum membuat tangkapan layar.',
          'Pengaturan: Putuskan dan hapus data untuk menghapus semua data NEOSIA dan mencabut izinnya.',
        ],
        gambar: [
          { jenis: 'dasbor', nama: 'neosia-pengaturan', ket: 'Pengaturan NEOSIA: tombol Hubungkan NEOSIA dan daftar halaman yang perlu dibuka.' },
          { jenis: 'dasbor', nama: 'neosia-ringkasan', ket: 'Ringkasan dengan NEOSIA terhubung: Kesiapan KRS dan kuliah hari ini.' },
          { jenis: 'dasbor', nama: 'neosia-jadwal', ket: 'Halaman Jadwal: kuliah tiap hari dalam satu pekan.' },
          { jenis: 'dasbor', nama: 'neosia-nilai', ket: 'Halaman Nilai, dengan nilai masih tersembunyi: grafik IPS dan transkrip.' },
        ],
        catatan: 'Kesiapan KRS dan Simulasi IPK adalah alat bantu, bukan keputusan. Sulo tidak mengisi KRS dan tidak memantau kuota kelas. Selalu konfirmasi ke dosen PA atau KPS.',
      },
      {
        id: 'pengaturan',
        judul: 'Pengaturan lain',
        isi: ['Buka dashboard, lalu Pengaturan. Tiga yang paling sering dipakai juga ada di Pengaturan pada popup.'],
        bisa: [
          'Tema: Ikuti sistem, Terang, atau Gelap.',
          'Bahasa: Indonesia atau Inggris.',
          'Format waktu tenggat: sisa waktu, jam tenggat, keduanya, atau hitung mundur.',
          'Nama panggilan untuk sapaan di Ringkasan. Hanya tersimpan di browsermu.',
          'Angkatan, untuk menyorot evaluasi studi yang menyebut angkatanmu di kalender.',
          'Salin info untuk laporan bug: versi dan catatan teknis, tanpa nama, NIM, atau isi tugas.',
        ],
        gambar: [{ jenis: 'dasbor', nama: 'pengaturan', ket: 'Halaman Pengaturan: tampilan, tentang kamu, dan notifikasi.' }],
      },
      {
        id: 'data',
        judul: 'Data dan privasi',
        isi: [
          'Semua data Sulo tersimpan di browsermu. Tidak ada yang dikirim ke pembuatnya, dan tidak ada pelacakan.',
          'Pakai Sulo di laptopmu sendiri, jangan di komputer bersama.',
        ],
        bisa: [
          'Menghapus semua data: Pengaturan, bagian Hapus data, lalu Hapus semua data. Data di SIKOLA tidak tersentuh.',
          'Mencopot ekstensi juga menghapus semuanya.',
          'Kalau kamu masuk ke SIKOLA dengan akun lain, Sulo langsung menyembunyikan data akun sebelumnya dan bertanya akun mana yang dipakai.',
        ],
        gambar: [{ jenis: 'dasbor', nama: 'pengaturan-data', ket: 'Bagian Data, Laporan bug, dan Hapus data di Pengaturan.' }],
      },
      {
        id: 'kapan',
        judul: 'Kapan Sulo mengecek SIKOLA',
        isi: [
          'Sulo mengecek dengan hemat supaya tidak membebani SIKOLA. Itu sebabnya data baru kadang muncul beberapa saat kemudian.',
        ],
        bisa: [
          'Otomatis kira-kira tiap 3 jam, selama browser terbuka dan laptop sedang dipakai.',
          'Sebentar setelah browser dibuka.',
          'Saat kamu mengeklik Perbarui di popup atau dashboard.',
          'Membuka popup atau dashboard tidak mengecek tugas baru. Yang tampil adalah data dari pengecekan terakhir.',
          'Membuka halaman Tugas membaca halaman nilai mata kuliah yang dipantau, paling sering sekali tiap 10 menit.',
          'Tidak mengecek pukul 00.00 sampai 06.00, dan tidak saat laptop tidak dipakai.',
        ],
        catatan: 'Sulo tidak menjaga sesi SIKOLA tetap hidup. Kalau sesinya habis, Sulo memberi tahu sekali, dan memperbarui sendiri begitu kamu masuk lagi di SIKOLA.',
      },
      {
        id: 'masalah',
        judul: 'Kalau ada yang janggal',
        isi: ['Jawaban lengkapnya ada di dashboard, halaman Bantuan. Ini yang paling sering ditanyakan.'],
        bisa: [
          'Tugas tidak muncul: cek apakah mata kuliahnya dipantau. Tugas tanpa tenggat di kalender SIKOLA, atau yang tenggatnya lebih dari 90 hari lagi, memang belum tampil.',
          'Daftar tidak berubah: pastikan kamu masih masuk di SIKOLA, lalu klik Perbarui.',
          'Pengingat tidak muncul: coba Kirim notifikasi uji, lalu cek jam tenang dan izin notifikasi browser di komputermu.',
          'Sulo menulis belum bisa membaca SIKOLA: klik Salin info, lalu kirim teksnya lewat formulir masukan.',
        ],
      },
    ],
  },
  android: {
    nama: 'Android dan iPhone',
    judul: 'Panduan aplikasi HP.',
    kenapa: 'Semua yang bisa kamu lakukan di aplikasi Sulo untuk Android dan iPhone, dari Ringkasan sampai NEOSIA. Yang berbeda di iPhone ditandai di bagiannya.',
    deskripsi: 'Panduan lengkap aplikasi Sulo untuk Android dan iPhone: ringkasan, tugas, kalender akademik, presensi, kabar terbaru, pantau tugas baru, pengingat, dan NEOSIA.',
    bagian: [
      {
        id: 'ringkasan',
        judul: 'Ringkasan',
        isi: [
          'Layar pertama saat Sulo dibuka. Di bawah layar ada lima tab: Ringkasan, Tugas, Kalender, Presensi, dan Lainnya.',
          'Sulo memperbarui sendiri saat dibuka kalau datanya lebih tua dari 15 menit.',
        ],
        bisa: [
          'Melihat tugas terdekat dan sisa waktunya, lalu ketuk Buka untuk melihat rinciannya.',
          'Membaca tiga angka: tugas terlambat, tenggat minggu ini, dan berapa hari lagi ke UAS.',
          'Melihat tugas berikutnya dan tenggat 7 hari ke depan.',
          'Melihat rata-rata presensi dan kegiatan kalender akademik berikutnya.',
          'Menarik layar ke bawah untuk memperbarui, paling cepat 5 menit sekali.',
        ],
        gambar: [{ jenis: 'hp', nama: 'ringkasan', ket: 'Ringkasan di aplikasi HP: tugas terdekat dan tiga angka minggu ini.' }],
      },
      {
        id: 'tugas',
        judul: 'Tugas',
        isi: ['Semua tugas dari mata kuliah yang kamu pantau, dikelompokkan menurut hari. Ketuk sebuah tugas untuk membuka rinciannya.'],
        bisa: [
          'Menyaring dengan tombol di atas: Semua, Terlambat, Hari ini, dan Minggu ini untuk yang belum selesai; Selesai, Dinilai, dan Sudah lama lewat untuk riwayatnya.',
          'Mencari tugas atau mata kuliah.',
          'Mengetuk lingkaran di kanan tugas untuk menandainya selesai. Tugas yang sudah dinilai di SIKOLA menampilkan Dinilai di tempat lingkaran itu.',
          'Mengetuk Tampilkan nilai untuk melihat angkanya. Bawaannya tersembunyi.',
          'Mengetuk tombol + di atas untuk menambah tugas sendiri, misalnya presentasi yang tidak ada di SIKOLA.',
          'Di rincian: memecah tugas jadi langkah kecil dan menulis catatan.',
          'Di rincian: memasang tenggat pribadi untuk tugas yang tidak diberi tenggat di SIKOLA.',
          'Dari tombol tiga titik: Buka di SIKOLA, Tambah ke kalender HP (di iPhone juga Google Kalender), atau Tunda pengingat.',
        ],
        gambar: [
          { jenis: 'hp', nama: 'tugas', ket: 'Tab Tugas: saringan di atas, tugas dikelompokkan per hari.' },
          { jenis: 'hp', nama: 'tugas-rincian', ket: 'Rincian tugas: langkah, catatan, dan tombol Tandai selesai.' },
        ],
        catatan: 'Tandai selesai hanya menandai di Sulo supaya pengingatnya berhenti. Mengumpulkan tugas tetap dilakukan di SIKOLA.',
      },
      {
        id: 'kalender',
        judul: 'Kalender akademik',
        isi: ['Kalender akademik Unhas dan tenggat tugasmu. Tanggalnya dari kalender resmi, dan tiap kegiatan menyebut sumbernya.'],
        bisa: [
          'Melihat kegiatan berikutnya, hitung mundurnya, dan sekarang minggu kuliah ke berapa.',
          'Berpindah antara tampilan Daftar dan Bulan.',
          'Mengetuk kategori untuk menyaring: Akademik, Ujian, Administrasi, Libur, dan lainnya.',
          'Mengetuk ikon lonceng untuk memilih tanggal yang diingatkan: KRS, UKT, UTS, UAS, dan batas lainnya.',
          'Menambahkan kalender umum ke Google Kalender, atau di iPhone juga ke Kalender iPhone, dari bagian "Tambahkan ke kalendermu".',
        ],
        gambar: [{ jenis: 'hp', nama: 'kalender', ket: 'Tab Kalender: hitung mundur ke UAS dan daftar kegiatan.' }],
      },
      {
        id: 'presensi',
        judul: 'Presensi',
        isi: ['Rekap kehadiranmu dari SIKOLA. Diperbarui otomatis sekali sehari, dan rincian tiap pertemuan diambil saat kamu membukanya.'],
        bisa: [
          'Melihat rata-rata presensi dan mata kuliah dengan persentase terendah.',
          'Melihat persentase, jumlah sesi, dan poin tiap mata kuliah.',
          'Mengetuk sebuah mata kuliah untuk melihat status tiap pertemuan: Hadir, Terlambat, Izin, atau Alpa.',
        ],
        gambar: [
          { jenis: 'hp', nama: 'presensi', ket: 'Tab Presensi: rata-rata dan persentase tiap mata kuliah.' },
          { jenis: 'hp', nama: 'presensi-rincian', ket: 'Rincian presensi satu mata kuliah: status tiap pertemuan.' },
        ],
        catatan: 'Sulo hanya membaca presensi. Mengisi presensi tetap dilakukan di SIKOLA.',
      },
      {
        id: 'lainnya',
        judul: 'Lainnya',
        isi: ['Tab kelima berisi semua yang tidak punya tab sendiri. Di atasnya terlihat status hubungan ke SIKOLA dan kapan terakhir diperbarui.'],
        bisa: [
          'Kabar terbaru: apa yang berubah di mata kuliahmu.',
          'Mata kuliah: memilih yang dipantau, mengganti nama dan warnanya.',
          'Pengaturan: pengingat, pemantauan, tampilan, NEOSIA, dan data.',
          'Bantuan: pertanyaan yang sering muncul, bisa dicari.',
          'Tentang dan Privasi: versi aplikasi dan apa yang disimpan.',
          'Jadwal dan Nilai muncul di sini setelah NEOSIA terhubung.',
        ],
        gambar: [{ jenis: 'hp', nama: 'lainnya', ket: 'Tab Lainnya: Kabar terbaru, Mata kuliah, Pengaturan, Bantuan, Tentang, dan Privasi.' }],
      },
      {
        id: 'kabar',
        judul: 'Kabar terbaru',
        isi: ['Buka dari Lainnya. Sulo mencatat materi baru, tugas baru, tenggat yang digeser, nilai atau feedback baru, dan forum serta pengumuman.'],
        bisa: [
          'Menyaring kabar menurut jenis dan mata kuliah.',
          'Mengetuk sebuah kabar untuk membukanya di SIKOLA.',
          'Menandai semua kabar sudah dilihat.',
        ],
        gambar: [{ jenis: 'hp', nama: 'kabar', ket: 'Kabar terbaru: tugas baru, tenggat berubah, dan nilai baru.' }],
      },
      {
        id: 'mata-kuliah',
        judul: 'Mata kuliah',
        isi: ['Buka dari Lainnya. Tugas, kabar, dan presensi hanya diambil dari mata kuliah yang dipantau.'],
        bisa: [
          'Menyalakan atau mematikan pemantauan tiap mata kuliah dengan tombol di kanannya.',
          'Mengganti nama tampilan dan warna mata kuliah.',
        ],
        gambar: [{ jenis: 'hp', nama: 'mata-kuliah', ket: 'Mata kuliah: tombol di kanan untuk memantau atau berhenti memantau.' }],
      },
      {
        id: 'pantau',
        judul: 'Pantau tugas baru',
        iphone: 'Di iPhone tidak ada pemantauan ini: iPhone tidak memberi aplikasi seperti Sulo waktu tetap di latar belakang. Tugas baru terlihat saat Sulo dibuka, dan pengingat tenggat tetap muncul dari data terakhir.',
        isi: [
          'Nyalakan di Lainnya, Pengaturan, bagian Notifikasi. Sulo lalu mengecek SIKOLA di latar belakang, sekitar tiap 20 menit siang hari dan 110 menit malam hari, dan memberi tahu saat ada tugas baru, tenggat berubah, nilai, kabar forum, atau materi baru.',
          'Selama menyala, sesi SIKOLA-mu tetap aktif di HP ini, jadi kamu jarang diminta masuk lagi. Karena itu Sulo menawarkan kunci aplikasi.',
        ],
        bisa: [
          'Menyalakan atau mematikannya kapan saja. Kalau mati, Sulo memperbarui saat dibuka, saat layar ditarik, atau saat kamu mengetuk Perbarui.',
          'Mengizinkan Sulo berjalan di latar belakang di pengaturan aplikasi HP, kalau HP-mu sering menidurkannya.',
          'Memilih suara notifikasi untuk tugas dan kabar baru.',
          'Membuka preferensi SIKOLA untuk menyalakan email dari SIKOLA sebagai pelengkap.',
        ],
        gambar: [{ jenis: 'hp', nama: 'pengaturan', ket: 'Pengaturan: Pantau tugas baru di atas, lalu pengingat tugas.' }],
        catatan: 'Hemat baterai: tiap cek hanya satu permintaan kecil. Pemantauan dijeda sendiri kalau Sulo tidak dibuka selama 7 hari.',
      },
      {
        id: 'pengingat',
        judul: 'Pengingat tenggat',
        iphone: 'Di iPhone, pengingat dijadwalkan untuk 7 hari ke depan dari data terakhir, jadi buka Sulo sesekali. Kalau tidak muncul, cek izin notifikasi Sulo dan mode Fokus.',
        isi: ['Notifikasi di HP sebelum tenggat. Jadwalnya dibuat di HP ini untuk 7 hari ke depan, jadi buka Sulo sesekali supaya ikut terbaru.'],
        bisa: [
          'Memilih kapan diingatkan, dari 3 hari sampai 1 jam sebelum tenggat.',
          'Memasang jam tenang. Pengingat terakhir sebelum tenggat tetap bisa lewat.',
          'Menyalakan ringkasan pagi pada jam yang kamu pilih.',
          'Memilih suara notifikasi, termasuk senyap.',
          'Memilih tanggal kalender akademik yang diingatkan.',
        ],
        catatan: 'Kalau pengingat tidak muncul, pastikan notifikasi Sulo diizinkan di Pengaturan HP. Waktunya bisa bergeser beberapa menit karena Android menghemat baterai.',
      },
      {
        id: 'neosia',
        judul: 'NEOSIA: jadwal, KRS, nilai',
        isi: [
          'Tambahan, baru aktif kalau kamu nyalakan. Setelah terhubung, Ringkasan bertambah Kesiapan KRS, dan Lainnya bertambah Jadwal dan Nilai.',
          'Datanya masuk saat kamu membuka halaman NEOSIA lewat Sulo, dan disimpan terenkripsi di HP ini.',
        ],
        bisa: [
          'Ringkasan: membaca Kesiapan KRS, yaitu kapan pengisian dibuka, status pembayaran, survei, sisa kuota SKS, status KRS, dan dosen PA.',
          'Jadwal: melihat kuliah tiap hari lengkap dengan jam dan ruangnya.',
          'Nilai: melihat IPK, grafik IPS tiap semester, transkrip, dan Simulasi IPK, setelah kamu menyalakan Tampilkan nilai di Pengaturan.',
          'Mengetuk Perbarui dari NEOSIA untuk mengambil data terbaru.',
          'Menyalakan mode privasi untuk menyamarkan nama, nilai, dan persentase presensi di layar.',
          'Putuskan NEOSIA di Pengaturan untuk menghapus semua data dan sesi NEOSIA di HP ini.',
        ],
        gambar: [
          { jenis: 'hp', nama: 'neosia-ringkasan', ket: 'Ringkasan dengan NEOSIA terhubung: Kesiapan KRS.' },
          { jenis: 'hp', nama: 'neosia-jadwal', ket: 'Jadwal: kuliah tiap hari dengan jam dan ruangnya.' },
          { jenis: 'hp', nama: 'neosia-nilai', ket: 'Nilai tersembunyi sampai kamu menyalakannya di Pengaturan.' },
        ],
        catatan: 'Kesiapan KRS dan Simulasi IPK adalah alat bantu, bukan keputusan. Sulo tidak mengisi KRS. Selalu konfirmasi ke dosen PA atau KPS.',
      },
      {
        id: 'keamanan',
        judul: 'Kunci, privasi, dan data',
        iphone: 'Di iPhone, sesi SIKOLA disimpan di Keychain, dan kunci aplikasi memakai Face ID atau kode iPhone. Pilih Keluar dan hapus data sebelum menghapus aplikasinya, karena iPhone menyimpan isi Keychain setelah aplikasi dihapus.',
        isi: ['Sesi SIKOLA-mu disimpan terenkripsi dengan kunci di Android Keystore, dan tidak pernah keluar dari HP ini.'],
        bisa: [
          'Kunci aplikasi: meminta sidik jari atau kunci layar HP setiap Sulo dibuka.',
          'Mode privasi: menyamarkan nama, nilai, dan persentase presensi di layar.',
          'Nama panggilan, format waktu tenggat, dan animasi (Otomatis, Penuh, atau Ringan).',
          'Keluar dan hapus data: menghapus sesi, semua data, dan pengingat terjadwal di HP ini. Data di SIKOLA tidak tersentuh.',
          'Salin info untuk laporan bug: versi dan catatan teknis, tanpa nama, NIM, sesi, atau isi tugas.',
        ],
      },
      {
        id: 'versi',
        judul: 'Memperbarui aplikasi',
        iphone: 'Di iPhone, versi baru dipasang dari laptop lewat Sideloadly, seperti saat pertama memasang. Masa 7 hari Apple ID gratis diperpanjang Sideloadly sendiri selama laptopmu menyala dan iPhone di WiFi yang sama.',
        isi: ['Sulo belum ada di Play Store, jadi versi baru dipasang dari berkas APK. Sulo memberi tahu saat ada, dan tidak pernah mengunduhnya sendiri.'],
        bisa: [
          'Saat muncul "Versi baru tersedia", ketuk Unduh. Browser HP membuka unduhannya.',
          'Buka berkas yang terunduh, lalu pilih Perbarui. Datamu tetap ada.',
          'Ketuk Nanti kalau belum sempat. Pemberitahuannya muncul lagi beberapa hari kemudian.',
        ],
        catatan: 'Sulo butuh Android 8 ke atas dan Android System WebView versi 111 atau lebih baru. Kalau layarnya kosong atau muncul "Perlu pembaruan", perbarui Android System WebView di Play Store.',
      },
      {
        id: 'masalah',
        judul: 'Kalau ada yang janggal',
        iphone: 'Di iPhone, Sulo yang tidak mau dibuka biasanya masa 7 harinya habis sebelum Sideloadly sempat menyegarkannya. Pasang lagi lewat Sideloadly di laptop dengan Apple ID yang sama; datamu tidak hilang.',
        isi: ['Jawaban lengkapnya ada di Lainnya, Bantuan. Ini yang paling sering ditanyakan.'],
        bisa: [
          'Tugas tidak muncul: cek apakah mata kuliahnya dipantau di Lainnya, Mata kuliah.',
          'Diminta masuk lagi padahal pemantauan menyala: HP-mu menunda Sulo terlalu lama. Masuk lagi, lalu izinkan Sulo berjalan di latar belakang.',
          'Pengingat tidak muncul: cek izin notifikasi Sulo dan jam tenang.',
          'Sulo menulis belum bisa membaca SIKOLA: buka Lainnya, Pengaturan, Salin info untuk laporan bug, lalu kirim teksnya.',
        ],
      },
    ],
  },
};
