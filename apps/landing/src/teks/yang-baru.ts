// "Yang baru di Sulo" (/yang-baru/): what each version changed, newest first, in the students' words, from
// CHANGELOG.md (the full technical list stays on GitHub). Every feature names the devices that get it, shows
// the apps' own screens with sample data where a screen says it best, and the page says plainly what Sulo
// reads that it did not before. Same voice and rules as the other pages: "kamu", no separators between
// phrases, terms from the apps' glossary.
import type { Bahasa } from '../teks';
import type { GambarPakai } from './pakai';

export type PerangkatBaru = 'ekstensi' | 'android' | 'iphone';

export interface FiturBaru {
  id: string;
  /** At most six words (a section title). */
  judul: string;
  perangkat: readonly PerangkatBaru[];
  isi: readonly string[];
  poin?: readonly string[];
  gambar?: GambarPakai;
  /** A drawn picture in place of a screen (the iPhone's own add-event sheet: no app screen shows it). */
  ilustrasi?: 'kalender';
  /** A link under the section, to a page of this site (its path is made in the component). */
  tautan?: { teks: string; ke: 'pasang-iphone' | 'privasi' | 'panduan-hp' };
  /** One of the version's most requested features (owner, 27 Nov 2026: the iPhone app and Sipakamase): first, on a card. */
  sorot?: true;
}

interface Halaman {
  judul: string;
  kenapa: string;
  deskripsi: string;
  remah: string;
  isiHalaman: string;
  perangkat: Record<PerangkatBaru, string>;
  untuk: string;
  versi: (v: string) => string;
  tanggal: (t: string) => string;
  /** The day this version came out, as the card's cap says it. */
  terbit: string;
  ringkas: string;
  /** The version card's other half: where this version runs. */
  tersedia: { judul: string; ket: Record<PerangkatBaru, string> };
  fitur: readonly FiturBaru[];
  kecil: { id: string; judul: string; daftar: readonly string[] };
  dibaca: { id: string; judul: string; isi: string; daftar: readonly string[]; tautan: string };
  perbarui: { id: string; judul: string; isi: string; cara: Record<PerangkatBaru, string>; panduanIphone: string };
  sebelumnya: { id: string; judul: string; tanggal: string; isi: string; daftar: readonly string[] };
  teknis: string;
  dataContoh: string;
  kalender: { judul: string; batal: string; tambah: string; mulai: string; selesai: string; tugas: string; waktuMulai: string; waktuSelesai: string; catatan: string };
}

export const yangBaru: Record<Bahasa, Halaman> = {
  id: {
    judul: 'Yang baru di Sulo.',
    kenapa: 'Apa saja yang berubah di tiap versi Sulo, dari yang terbaru. Tiap fitur menyebut perangkat yang mendapatkannya, dan gambarnya diambil dari layar Sulo sendiri.',
    deskripsi: 'Yang baru di Sulo 1.1.0: aplikasi iPhone dan Sipakamase, ditambah nilai tugas dari SIKOLA, tugas sendiri, dan tambah ke kalender perangkatmu.',
    remah: 'Yang baru',
    isiHalaman: 'Isi halaman',
    perangkat: { ekstensi: 'Ekstensi', android: 'Android', iphone: 'iPhone' },
    untuk: 'Untuk',
    versi: (v) => `Versi ${v}`,
    tanggal: (t) => `Terbit ${t}`,
    terbit: '28 November 2026',
    ringkas: 'Dua yang paling banyak diminta akhirnya ada: Sulo untuk iPhone, dan Sipakamase untuk MKPK. Ditambah nilai tugas dari SIKOLA, tugas yang kamu catat sendiri, dan tambah ke kalender perangkatmu.',
    tersedia: { judul: 'Tersedia untuk', ket: { ekstensi: 'Chrome dan Edge, di laptop', android: 'Android 8 ke atas', iphone: 'iOS 16.4 ke atas, lewat Sideloadly' } },
    fitur: [
      {
        id: 'iphone',
        judul: 'Sulo untuk iPhone',
        sorot: true,
        perangkat: ['iphone'],
        isi: [
          'Sulo sekarang ada di iPhone, dengan layar yang sama seperti di Android: Ringkasan, Tugas, Kalender, Presensi, NEOSIA, dan Sipakamase.',
          'Sulo belum ada di App Store, jadi dipasang sekali dari laptop lewat Sideloadly dengan Apple ID-mu. Dengan Apple ID gratis, Sideloadly memperpanjangnya sendiri tiap 7 hari selama laptopmu menyala dan iPhone ada di WiFi yang sama.',
        ],
        poin: [
          'Geser dari tepi kiri layar untuk kembali, seperti aplikasi iPhone lainnya.',
          'Ikon gelap dan berwarna, mengikuti tampilan Layar Utama iPhone-mu.',
          'Tugas baru terlihat saat Sulo dibuka, karena iPhone tidak memberi aplikasi seperti Sulo waktu tetap di latar belakang. Pengingat tenggat tetap muncul.',
          'Jaga sesi SIKOLA (pilihan) menjaga sesimu tetap aktif saat iPhone memberi waktu di latar belakang.',
        ],
        gambar: { jenis: 'hp', nama: 'ringkasan', ket: 'Ringkasan di iPhone: tugas terdekat dan tiga angka minggu ini.' },
        tautan: { teks: 'Lihat cara pasang di iPhone', ke: 'pasang-iphone' },
      },
      {
        id: 'nilai',
        judul: 'Nilai tugas dari SIKOLA',
        perangkat: ['ekstensi', 'android', 'iphone'],
        isi: [
          'Halaman Tugas sekarang tahu tugas mana yang sudah dinilai dosen. Tugas yang sudah dinilai ditandai selesai sendiri, jadi daftarmu tidak lagi penuh tugas lama.',
          'Sulo membaca halaman nilai tiap mata kuliah yang kamu pantau, hanya kolom nilainya dan tidak pernah komentar dosen, saat kamu membuka Tugas (paling sering sekali tiap 10 menit) dan saat Sulo memperbarui.',
        ],
        poin: [
          'Di tempat jam tenggat atau lingkaran selesai, tugas yang dinilai menampilkan Dinilai.',
          'Angkanya tersembunyi sampai kamu memilih Tampilkan nilai, tersamar di mode privasi, dan tidak pernah masuk notifikasi.',
          'Saringan Selesai, Dinilai, dan Sudah lama lewat menampilkan riwayat tugasmu, termasuk tugas lama yang tidak ada di kalender SIKOLA.',
        ],
        gambar: { jenis: 'dasbor', nama: 'baru-nilai', ket: 'Halaman Tugas di dashboard: tugas yang sudah dinilai, dengan angkanya yang masih tersembunyi.' },
      },
      {
        id: 'tugas-sendiri',
        judul: 'Tambah tugas sendiri',
        perangkat: ['ekstensi', 'android', 'iphone'],
        isi: [
          'Tugas dari dosen yang tidak ada di SIKOLA, misalnya presentasi kelompok atau proyek, bisa kamu catat di Sulo dengan judul, mata kuliah, dan tenggatnya.',
          'Sulo mengingatkannya seperti tugas dari SIKOLA. Tugas ini hanya tersimpan di perangkatmu.',
        ],
        poin: [
          'Di dashboard, tekan Tambah tugas di kanan atas halaman Tugas.',
          'Di HP, ketuk tombol + di atas tab Tugas.',
          'Langkah, catatan, dan pengingatnya bekerja seperti tugas lain.',
        ],
        gambar: { jenis: 'dasbor', nama: 'baru-sendiri', ket: 'Tugas sendiri, Presentasi kelompok, di antara tugas dari SIKOLA, dengan tombol Tambah tugas di atas.' },
      },
      {
        id: 'kalender',
        judul: 'Tambah ke kalender perangkatmu',
        perangkat: ['ekstensi', 'android', 'iphone'],
        isi: ['Satu tugas sekarang bisa masuk ke kalender yang memang kamu pakai, dengan judul, mata kuliah, tenggat, dan tautan ke SIKOLA. Nilai tidak pernah ikut.'],
        poin: [
          'iPhone: Tambah ke Kalender iPhone membuka lembar tambah acara bawaan iOS. Di iOS 16, iPhone meminta izin Kalender sekali; iOS 17 ke atas tidak meminta izin.',
          'Android: Tambah ke kalender HP membuka aplikasi kalender di HP-mu, tanpa izin apa pun.',
          'Laptop: selain Google Kalender, ada berkas .ics yang terbuka di Kalender Mac atau Outlook.',
          'Kalender akademik Unhas bisa dilanggan langsung ke Kalender iPhone.',
        ],
        ilustrasi: 'kalender',
      },
      {
        id: 'sipakamase',
        judul: 'Sipakamase dan kartu MKPK',
        sorot: true,
        perangkat: ['ekstensi', 'android', 'iphone'],
        isi: [
          'Dari data NEOSIA, kartu MKPK menunjukkan SKS MKPK di transkrip dan KRS-mu, dan MKPK yang ditawarkan prodimu semester ini.',
          'Kalau kamu menghubungkan Sipakamase (pilihan, baru aktif setelah kamu menyetujuinya), kartu itu juga menunjukkan SKS kegiatan yang belum dikonversi dan MKPK yang sudah lulus tapi belum masuk NEOSIA.',
        ],
        poin: [
          'Pengingat sebelum batas penginputan nilai, dan saat ada nilai yang perlu diklaim.',
          'Sulo hanya membaca lima halaman MKPK-mu. Sulo tidak pernah mengisi, menghapus, mengonversi, atau mengklaim apa pun.',
          'Begitu NEOSIA siap dan kartu MKPK tampil, Ringkasan menawarkan Hubungkan Sipakamase, jadi kamu tidak perlu mencarinya di Pengaturan.',
        ],
        gambar: { jenis: 'dasbor', nama: 'baru-sipakamase', ket: 'Kartu MKPK di Ringkasan, dengan data dari NEOSIA dan Sipakamase.' },
      },
      {
        id: 'pantau',
        judul: 'Kabar SIKOLA lebih cepat di laptop',
        perangkat: ['ekstensi'],
        isi: ['Nyalakan Pantau tugas baru di ekstensi (pilihan), dan Sulo mengecek SIKOLA tiap 15 menit selama laptopmu dipakai, juga tiap kali kamu membuka Sulo. Tugas baru dan kabar lain datang sebagai notifikasi tanpa perlu menekan Perbarui.'],
        poin: ['Selama menyala, sesi SIKOLA-mu tetap aktif di browser ini.', 'Kalau Sulo tidak dibuka 7 hari, pemantauan berhenti dengan satu notifikasi.'],
      },
    ],
    kecil: {
      id: 'kecil',
      judul: 'Perubahan kecil',
      daftar: [
        'Gerak kecil yang membantu: rincian bergeser masuk dan keluar, lingkaran selesai sedikit meletup, dan batang mingguan tumbuh sekali. Mode gerak dikurangi dan mode ringan tetap diam.',
        'Masuk lagi untuk semua sumber sekaligus di HP: ringkasan pagi menawarkan Masuk lagi kalau SIKOLA, NEOSIA, atau Sipakamase keluar, paling banyak sekali sehari.',
        'Perbarui NEOSIA otomatis di Android (pilihan), dan Perbarui dari NEOSIA menutup halamannya sendiri setelah datanya masuk.',
        'Perbarui manual paling sering tiap 5 menit.',
        'Tugas yang sudah selesai tidak lagi menawarkan tambah ke kalender.',
        'Di HP tidak ada scrollbar, baris yang digeser ke samping hanya bergeser ke samping, dan teks aplikasi tidak terblok saat ditekan lama.',
        'Popup ekstensi selalu menampilkan Buka dashboard, dan tiap tombol di ekstensi berbentuk pil seperti di HP.',
      ],
    },
    dibaca: {
      id: 'dibaca',
      judul: 'Yang Sulo baca bertambah',
      isi: 'Supaya jelas sejak awal, ini yang dibaca Sulo 1.1.0 dan tidak dibaca versi sebelumnya. Semuanya tetap hanya dibaca dan tersimpan di perangkatmu.',
      daftar: [
        'Halaman nilai tiap mata kuliah yang kamu pantau di SIKOLA: hanya kolom nilai dan tautan tugas, tanpa komentar dosen, dalam batas harian yang sama.',
        'Sipakamase, hanya kalau kamu menghubungkannya: lima halaman MKPK-mu.',
        'Di iPhone dengan iOS 16, izin Kalender, hanya saat kamu menambah tugas ke Kalender iPhone. Sulo tidak membaca kalendermu.',
      ],
      tautan: 'Baca kebijakan privasi lengkap',
    },
    perbarui: {
      id: 'perbarui',
      judul: 'Cara memperbarui ke 1.1.0',
      isi: 'Datamu tetap ada di semua perangkat.',
      cara: {
        ekstensi: 'Ekstensi dari Chrome Web Store memperbarui dirinya sendiri. Kalau kamu memasangnya manual dari berkas zip, pasang dari Chrome Web Store, lalu hapus versi manualnya.',
        android: 'Sulo memberi tahu saat ada versi baru. Ketuk Unduh, lalu pasang APK-nya di atas versi lama.',
        iphone: 'Ikuti panduan pasang di iPhone. Kalau sudah ada versi lama, pasang berkas .ipa yang baru lewat Sideloadly dengan Apple ID yang sama.',
      },
      panduanIphone: 'Buka panduan iPhone',
    },
    sebelumnya: {
      id: 'versi-1-0-0',
      judul: 'Versi 1.0.0',
      tanggal: 'Terbit 25 November 2026',
      isi: 'Rilis pertama untuk umum.',
      daftar: [
        'Ekstensi untuk Chrome dan Edge, dan aplikasi Android.',
        'Tugas dan tenggat dari kalender SIKOLA, pengingat, dan ringkasan pagi.',
        'Kabar terbaru: tugas baru, tenggat yang berubah, materi, dan forum.',
        'Presensi per mata kuliah, dan kalender akademik Unhas.',
        'NEOSIA (pilihan): jadwal kuliah, kesiapan KRS, dan nilai yang disembunyikan.',
      ],
    },
    teknis: 'Rincian teknis tiap versi di GitHub',
    dataContoh: 'Gambar layar memakai data contoh, bukan data siapa pun.',
    kalender: { judul: 'Acara Baru', batal: 'Batal', tambah: 'Tambah', mulai: 'Mulai', selesai: 'Selesai', tugas: 'Laporan praktikum (Mekanika Fluida)', waktuMulai: 'Rab, 25 Nov 10.00', waktuSelesai: '10.30', catatan: 'Tugas Mekanika Fluida di SIKOLA.' },
  },
  en: {
    judul: 'What’s new in Sulo.',
    kenapa: 'What each version of Sulo changed, newest first. Each feature names the devices that get it, and the pictures are Sulo’s own screens.',
    deskripsi: 'What’s new in Sulo 1.1.0: the iPhone app and Sipakamase, plus task grades from SIKOLA, your own tasks, and adding to your device’s calendar.',
    remah: 'What’s new',
    isiHalaman: 'On this page',
    perangkat: { ekstensi: 'Extension', android: 'Android', iphone: 'iPhone' },
    untuk: 'For',
    versi: (v) => `Version ${v}`,
    tanggal: (t) => `Released ${t}`,
    terbit: '28 November 2026',
    ringkas: 'The two most requested are finally here: Sulo for iPhone, and Sipakamase for MKPK. Plus task grades from SIKOLA, tasks you note down yourself, and adding to your device’s calendar.',
    tersedia: { judul: 'Available for', ket: { ekstensi: 'Chrome and Edge, on a laptop', android: 'Android 8 or later', iphone: 'iOS 16.4 or later, with Sideloadly' } },
    fitur: [
      {
        id: 'iphone',
        judul: 'Sulo for iPhone',
        sorot: true,
        perangkat: ['iphone'],
        isi: [
          'Sulo is now on iPhone, with the same screens as on Android: Overview, Tasks, Calendar, Attendance, NEOSIA and Sipakamase.',
          'Sulo is not on the App Store yet, so it is installed once from a laptop with Sideloadly and your Apple ID. With a free Apple ID, Sideloadly renews it by itself every 7 days while your laptop is on and the iPhone shares its Wi-Fi.',
        ],
        poin: [
          'Swipe in from the left edge to go back, like other iPhone apps.',
          'Dark and tinted icons that follow your Home Screen’s look.',
          'New tasks show when you open Sulo, as the iPhone gives apps like Sulo no fixed time in the background. Deadline reminders still come.',
          'Keep the SIKOLA session (optional) keeps your session active when the iPhone gives it time in the background.',
        ],
        gambar: { jenis: 'hp', nama: 'ringkasan', ket: 'Overview on iPhone: the task due soonest and this week’s three numbers.' },
        tautan: { teks: 'See how to install on iPhone', ke: 'pasang-iphone' },
      },
      {
        id: 'nilai',
        judul: 'Task grades from SIKOLA',
        perangkat: ['ekstensi', 'android', 'iphone'],
        isi: [
          'Tasks now knows which tasks your lecturer has graded. A graded task is marked as done on its own, so your list is no longer full of old tasks.',
          'Sulo reads the grades page of each course you follow, the grade column only and never the lecturer’s comments, when you open Tasks (at most once every 10 minutes) and when Sulo updates.',
        ],
        poin: [
          'Where the due time or the done circle was, a graded task says Graded.',
          'The number stays hidden until you choose Show grades, is masked in privacy mode, and never appears in a notification.',
          'The Done, Graded and Long past due filters show your task history, older assignments missing from the SIKOLA calendar included.',
        ],
        gambar: { jenis: 'dasbor', nama: 'baru-nilai', ket: 'Tasks on the dashboard: graded tasks, with their numbers still hidden.' },
      },
      {
        id: 'tugas-sendiri',
        judul: 'Add your own tasks',
        perangkat: ['ekstensi', 'android', 'iphone'],
        isi: [
          'Work your lecturer gave outside SIKOLA, such as a group presentation or a project, can be noted down in Sulo with its title, course and due date.',
          'Sulo reminds you of it like a SIKOLA task. It is kept on your device only.',
        ],
        poin: ['On the dashboard, press Add a task at the top right of Tasks.', 'On the phone, tap the + button at the top of Tasks.', 'Its steps, note and reminders work like any other task’s.'],
        gambar: { jenis: 'dasbor', nama: 'baru-sendiri', ket: 'An own task, Group presentation, among the SIKOLA tasks, with Add a task at the top.' },
      },
      {
        id: 'kalender',
        judul: 'Add to your device’s calendar',
        perangkat: ['ekstensi', 'android', 'iphone'],
        isi: ['A task can now go into the calendar you actually use, with its title, course, due time and SIKOLA link. Never a grade.'],
        poin: [
          'iPhone: Add to iPhone Calendar opens iOS’s own add-event sheet. On iOS 16 the iPhone asks for Calendar access once; iOS 17 and later ask nothing.',
          'Android: Add to the phone’s calendar opens your phone’s calendar app, with no permission at all.',
          'Laptop: besides Google Calendar, an .ics file opens in Mac Calendar or Outlook.',
          'The Unhas academic calendar can be subscribed to straight from the iPhone’s Calendar.',
        ],
        ilustrasi: 'kalender',
      },
      {
        id: 'sipakamase',
        judul: 'Sipakamase and the MKPK card',
        sorot: true,
        perangkat: ['ekstensi', 'android', 'iphone'],
        isi: [
          'From NEOSIA, the MKPK card shows the MKPK credits on your transcript and KRS, and the MKPK courses your program offers this semester.',
          'If you connect Sipakamase (optional, on only once you agree), the card also shows activity credits not yet converted and passed MKPK courses not yet in NEOSIA.',
        ],
        poin: [
          'Reminders before the grade-entry deadline, and when a grade needs claiming.',
          'Sulo only reads five pages of your MKPK data. It never fills in, deletes, converts or claims anything.',
          'Once NEOSIA is set up and the MKPK card shows, Overview offers Connect Sipakamase, so you need not look for it in Settings.',
        ],
        gambar: { jenis: 'dasbor', nama: 'baru-sipakamase', ket: 'The MKPK card on Overview, with data from NEOSIA and Sipakamase.' },
      },
      {
        id: 'pantau',
        judul: 'SIKOLA news sooner on a laptop',
        perangkat: ['ekstensi'],
        isi: ['Turn on Watch for new tasks in the extension (optional), and Sulo checks SIKOLA every 15 minutes while your laptop is in use, and each time you open Sulo. New tasks and other news arrive as notifications without pressing Update.'],
        poin: ['While it is on, your SIKOLA session stays active in this browser.', 'If Sulo is not opened for 7 days, watching stops with one notification.'],
      },
    ],
    kecil: {
      id: 'kecil',
      judul: 'Smaller changes',
      daftar: [
        'Small motion that helps: details slide in and out, the done circle pops a little, and the week’s bars grow once. Reduced motion and the light mode keep things still.',
        'Sign in again to every source at once on the phone: the morning summary offers Sign in again when SIKOLA, NEOSIA or Sipakamase signed you out, at most once a day.',
        'Update NEOSIA automatically on Android (optional), and Update from NEOSIA closes its page by itself once the data is in.',
        'Update by hand at most every 5 minutes.',
        'A finished task no longer offers to be added to a calendar.',
        'On the phone there are no scrollbars, sideways rows only scroll sideways, and a long press no longer selects the app’s own text.',
        'The extension’s popup always shows Open dashboard, and every button in the extension is a pill as on the phone.',
      ],
    },
    dibaca: {
      id: 'dibaca',
      judul: 'What Sulo now reads',
      isi: 'To be clear from the start, this is what Sulo 1.1.0 reads that earlier versions did not. All of it is still read only and kept on your device.',
      daftar: [
        'The grades page of each course you follow on SIKOLA: the grade column and task links only, never the lecturer’s comments, within the same daily limit.',
        'Sipakamase, only if you connect it: five pages of your MKPK data.',
        'On iPhone with iOS 16, Calendar access, only when you add a task to the iPhone’s Calendar. Sulo never reads your calendar.',
      ],
      tautan: 'Read the full privacy policy',
    },
    perbarui: {
      id: 'perbarui',
      judul: 'Updating to 1.1.0',
      isi: 'Your data stays on every device.',
      cara: {
        ekstensi: 'The extension from the Chrome Web Store updates itself. If you installed it by hand from the zip, install it from the Chrome Web Store, then remove the manual one.',
        android: 'Sulo tells you when a new version is out. Tap Download, then install the APK over the old one.',
        iphone: 'Follow the iPhone install guide. If you have an older version, install the new .ipa with Sideloadly and the same Apple ID.',
      },
      panduanIphone: 'Open the iPhone guide',
    },
    sebelumnya: {
      id: 'versi-1-0-0',
      judul: 'Version 1.0.0',
      tanggal: 'Released 25 November 2026',
      isi: 'The first public release.',
      daftar: [
        'An extension for Chrome and Edge, and an Android app.',
        'Tasks and deadlines from the SIKOLA calendar, reminders and the morning summary.',
        'Latest updates: new tasks, changed deadlines, materials and forum posts.',
        'Attendance per course, and the Unhas academic calendar.',
        'NEOSIA (optional): class schedule, KRS readiness and hidden grades.',
      ],
    },
    teknis: 'Each version’s technical details on GitHub',
    dataContoh: 'The screens use sample data, nobody’s real data.',
    kalender: { judul: 'New Event', batal: 'Cancel', tambah: 'Add', mulai: 'Starts', selesai: 'Ends', tugas: 'Lab report (Mekanika Fluida)', waktuMulai: 'Wed, 25 Nov 10:00', waktuSelesai: '10:30', catatan: 'Mekanika Fluida task on SIKOLA.' },
  },
};
