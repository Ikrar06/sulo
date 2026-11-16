// Help: how Sulo works and the FAQ, in both languages. Written once as data
// (same pattern as lib/privacy/content.ts) for the dashboard's Help page and,
// later, the landing page. Bundled, so it opens without internet.
// Plain words for students (lib/i18n/glossary.md): no "sync", "request",
// "sesskey" or "server".

export type Lang = 'id' | 'en';
export type Text = Record<Lang, string>;

export interface HelpSection {
  heading: Text;
  paragraphs: Text[];
}

export interface FaqEntry {
  /** Stable anchor: #bantuan/<id>. */
  id: string;
  q: Text;
  a: Text[];
}

export const HOW_IT_WORKS: HelpSection[] = [
  {
    heading: { id: 'Dari mana tugasmu datang', en: 'Where your tasks come from' },
    paragraphs: [
      {
        id: 'Sulo membaca SIKOLA dengan login yang sudah ada di browsermu, persis seperti saat kamu membuka SIKOLA sendiri. Sulo tidak pernah meminta atau menyimpan password.',
        en: 'Sulo reads SIKOLA with the login already in your browser, just like when you open SIKOLA yourself. Sulo never asks for or keeps your password.',
      },
      {
        id: 'Tugas dan tenggat diambil dari kalender SIKOLA, untuk mata kuliah yang kamu tandai aktif. Sulo hanya membaca; ia tidak mengumpulkan tugas dan tidak mengubah apa pun di SIKOLA.',
        en: 'Tasks and due dates come from the SIKOLA calendar, for the courses you marked as active. Sulo only reads; it never hands in work or changes anything in SIKOLA.',
      },
    ],
  },
  {
    heading: { id: 'Kapan Sulo memeriksa', en: 'When Sulo checks' },
    paragraphs: [
      {
        id: 'Sulo memeriksa kira-kira tiap 3 jam selama browser terbuka dan kamu sedang memakai laptop, sebentar setelah browser dibuka, dan saat kamu mengklik "Perbarui". Pukul 00.00 sampai 06.00 Sulo tidak memeriksa. Membuka popup atau dashboard tidak memeriksa SIKOLA.',
        en: 'Sulo checks about every 3 hours while the browser is open and you are using your laptop, shortly after the browser starts, and when you click "Update". It does not check from 00:00 to 06:00. Opening the popup or the dashboard never checks SIKOLA.',
      },
      {
        id: 'Ada batas harian supaya Sulo tidak membebani SIKOLA. Kalau batas itu tercapai, Sulo memeriksa lagi besok dan daftar terakhir tetap tampil.',
        en: 'There is a daily limit so Sulo never weighs on SIKOLA. When it is reached, Sulo checks again tomorrow and your last list stays on screen.',
      },
    ],
  },
  {
    heading: { id: 'Di mana datamu disimpan', en: 'Where your data is kept' },
    paragraphs: [
      {
        id: 'Semuanya tersimpan di browsermu sendiri. Tidak ada yang dikirim ke pengembang, tidak ada iklan, tidak ada pelacakan. Kalender akademik dan satu berkas pengaturan kecil diambil dari repo data publik Sulo tanpa membawa informasi apa pun tentangmu.',
        en: 'Everything stays in your own browser. Nothing is sent to the developer, no ads, no tracking. The academic calendar and one small settings file come from Sulo’s public data repository, carrying nothing about you.',
      },
    ],
  },
];

export const FAQ: FaqEntry[] = [
  {
    id: 'aman',
    q: { id: 'Apakah Sulo aman?', en: 'Is Sulo safe?' },
    a: [
      {
        id: 'Sulo hanya membaca data akunmu sendiri di SIKOLA, tidak meminta password, dan tidak mengirim data ke mana pun. Kodenya tidak memuat apa pun dari luar ekstensi. Izinnya hanya SIKOLA, penyimpanan, alarm, notifikasi, dan status aktif atau tidaknya laptop.',
        en: 'Sulo only reads your own account’s data in SIKOLA, never asks for your password and sends your data nowhere. It loads no code from outside the extension. Its permissions are SIKOLA, storage, alarms, notifications and whether your laptop is in use.',
      },
      {
        id: 'Pakai Sulo di laptopmu sendiri, jangan di komputer bersama.',
        en: 'Use Sulo on your own laptop, not on a shared computer.',
      },
    ],
  },
  {
    id: 'password',
    q: { id: 'Apakah Sulo perlu password SIKOLA?', en: 'Does Sulo need my SIKOLA password?' },
    a: [
      {
        id: 'Tidak. Masuk ke SIKOLA seperti biasa di browser yang sama. Sulo memakai login itu dan tidak pernah melihat password-mu.',
        en: 'No. Sign in to SIKOLA as usual in the same browser. Sulo uses that login and never sees your password.',
      },
    ],
  },
  {
    id: 'tugas-tidak-muncul',
    q: { id: 'Kenapa ada tugas yang tidak muncul?', en: 'Why is a task missing?' },
    a: [
      {
        id: 'Biasanya karena salah satu ini: mata kuliahnya belum ditandai aktif (Pengaturan, lalu "Atur mata kuliah"); tugasnya belum dibuka dosen atau tidak punya tenggat di kalender SIKOLA; tenggatnya lebih dari 90 hari lagi; atau kamu sudah menandainya selesai. Tugas yang sudah dikumpulkan bisa hilang dari kalender SIKOLA, dan Sulo menyebutnya "mungkin sudah dikumpulkan".',
        en: 'Usually one of these: the course is not marked as active (Settings, then "Choose courses"); the lecturer has not opened the task yet or it has no due date in the SIKOLA calendar; it is due more than 90 days away; or you marked it as done. Handed-in tasks can drop out of the SIKOLA calendar, and Sulo calls them "probably handed in".',
      },
    ],
  },
  {
    id: 'tidak-diperbarui',
    q: { id: 'Kenapa daftarku tidak diperbarui?', en: 'Why is my list not updating?' },
    a: [
      {
        id: 'Lihat baris di bawah judul popup. "Masuk ke SIKOLA lagi" berarti login SIKOLA-mu habis: buka SIKOLA dan masuk, lalu Sulo lanjut sendiri. "Sudah cukup sering memeriksa hari ini" berarti batas harian tercapai. Kalau kamu offline, daftar terakhir tetap tampil. Sulo juga tidak memeriksa saat laptop tidak dipakai atau pada pukul 00.00 sampai 06.00.',
        en: 'Look at the line under the popup’s title. "Sign in to SIKOLA again" means your SIKOLA login ended: open SIKOLA and sign in, and Sulo carries on. "Checked often enough today" means the daily limit was reached. When you are offline, the last list stays. Sulo also does not check while the laptop is not in use or from 00:00 to 06:00.',
      },
    ],
  },
  {
    id: 'pengingat',
    q: { id: 'Kenapa pengingat tidak muncul?', en: 'Why do reminders not show up?' },
    a: [
      {
        id: 'Coba "Kirim notifikasi uji" di Pengaturan. Kalau tidak muncul, nyalakan notifikasi untuk Chrome di komputermu: di macOS lewat Pengaturan Sistem, Notifikasi, Google Chrome; di Windows lewat Pengaturan, Sistem, Notifikasi, lalu matikan "Fokus" atau "Jangan ganggu".',
        en: 'Try "Send a test notification" in Settings. If nothing shows, turn on notifications for Chrome on your computer: on macOS in System Settings, Notifications, Google Chrome; on Windows in Settings, System, Notifications, and turn off Focus or Do not disturb.',
      },
      {
        id: 'Pengingat juga diam selama jam tenang (bawaan 22.00 sampai 06.00, kecuali pengingat terakhir), untuk mata kuliah yang tidak aktif, dan untuk tugas yang sudah kamu tandai selesai.',
        en: 'Reminders also stay quiet during quiet hours (22:00 to 06:00 by default, except the last reminder), for courses that are not active, and for tasks you marked as done.',
      },
    ],
  },
  {
    id: 'macos',
    q: { id: 'Di macOS, di mana tombol "Tunda" dan "Tandai selesai" pada notifikasi?', en: 'On macOS, where are "Snooze" and "Mark as done" on a notification?' },
    a: [
      {
        id: 'macOS menyembunyikannya di balik tombol "Opsi" pada notifikasi. Pilih gaya "Peringatan" untuk Chrome kalau ingin notifikasi tetap tampil sampai ditutup. Aksi yang sama juga ada di menu "⋯" pada tugas di popup.',
        en: 'macOS hides them behind the "Options" button on the notification. Choose the "Alerts" style for Chrome to keep notifications until you close them. The same actions are in the "⋯" menu of a task in the popup.',
      },
    ],
  },
  {
    id: 'kabar-lama',
    q: { id: 'Kenapa ada kabar materi baru padahal materinya sudah lama ada?', en: 'Why is a material "new" when it has been there a while?' },
    a: [
      {
        id: 'Pemeriksaan pertama tiap mata kuliah hanya mencatat keadaan awal, tanpa kabar. Setelah itu Sulo memeriksa isi mata kuliah paling sering 6 jam sekali, dan paling banyak lima mata kuliah sekaligus. Materi yang baru ditampilkan dosen dari keadaan tersembunyi, atau tugas yang baru masuk jendela 90 hari, karena itu bisa terasa lama.',
        en: 'The first check of each course only records how it looks, without updates. After that Sulo looks inside a course at most every 6 hours, five courses at a time. A material the lecturer just unhid, or a task that just came within 90 days, can therefore look old.',
      },
    ],
  },
  {
    id: 'mata-kuliah-aktif',
    q: { id: 'Bagaimana cara mengganti mata kuliah aktif?', en: 'How do I change my active courses?' },
    a: [
      {
        id: 'Buka dashboard, halaman Mata kuliah, lalu centang atau hapus centang. Bisa juga lewat ⚙ di popup, "Atur mata kuliah". Kalau mata kuliah baru belum ada di daftar, klik "Segarkan daftar".',
        en: 'Open the dashboard’s Courses page and tick or untick. You can also use ⚙ in the popup, "Choose courses". If a new course is not listed yet, click "Refresh list".',
      },
    ],
  },
  {
    id: 'akun-lain',
    q: { id: 'Apa yang terjadi kalau aku masuk SIKOLA dengan akun lain?', en: 'What happens if I sign in to SIKOLA with another account?' },
    a: [
      {
        id: 'Sulo langsung menyembunyikan tugas akun sebelumnya dan berhenti memeriksa serta mengingatkan. Popup bertanya: "Pakai akun ini" menghapus data akun sebelumnya di Sulo dan memulai pengaturan untuk akun baru; "Nanti" membiarkan semuanya tersembunyi sampai kamu masuk lagi dengan akun sebelumnya. Data di SIKOLA tidak tersentuh.',
        en: 'Sulo hides the previous account’s tasks at once and stops checking and reminding. The popup asks: "Use this account" deletes the previous account’s data in Sulo and starts setup for the new one; "Later" keeps everything hidden until you sign in with the previous account again. Nothing in SIKOLA is touched.',
      },
    ],
  },
  {
    id: 'hapus-data',
    q: { id: 'Bagaimana cara menghapus semua data Sulo?', en: 'How do I delete all of Sulo’s data?' },
    a: [
      {
        id: 'Di Pengaturan, bagian "Data dan statistik", atau ⚙ di popup, pilih "Hapus semua data". Ini menghapus tugas, mata kuliah, pengingat, kabar terbaru, dan pengaturan di browser ini. Data di SIKOLA tidak tersentuh. Mencopot ekstensi juga menghapus semuanya.',
        en: 'In Settings, "Data and statistics", or ⚙ in the popup, choose "Delete all data". It deletes tasks, courses, reminders, latest updates and settings in this browser. Nothing in SIKOLA is touched. Removing the extension deletes everything too.',
      },
    ],
  },
  {
    id: 'resmi',
    q: { id: 'Apakah Sulo resmi dari Unhas?', en: 'Is Sulo official?' },
    a: [
      {
        id: 'Tidak. Sulo adalah aplikasi tidak resmi dan tidak berafiliasi dengan Universitas Hasanuddin. Untuk hal penting, selalu rujuk SIKOLA dan dokumen resmi kampus.',
        en: 'No. Sulo is not an official app and is not affiliated with Universitas Hasanuddin. For anything important, always check SIKOLA and the university’s official documents.',
      },
    ],
  },
  {
    id: 'sikola-berubah',
    q: { id: 'Bagaimana kalau SIKOLA berubah?', en: 'What if SIKOLA changes?' },
    a: [
      {
        id: 'Kalau Sulo tidak lagi bisa membaca SIKOLA dengan benar, popup menulis "Sulo belum bisa membaca SIKOLA dengan benar" dan Sulo tidak menebak isinya. Daftar terakhir tetap tampil. Klik "Salin info" dan kirim teksnya ke pengelola; teks itu tidak memuat data pribadi.',
        en: 'If Sulo can no longer read SIKOLA properly, the popup says "Sulo can’t read SIKOLA properly yet" and Sulo does not guess. Your last list stays. Click "Copy info" and send the text to the maintainer; it holds no personal data.',
      },
    ],
  },
  {
    id: 'langganan-kalender',
    q: { id: 'Bagaimana cara berlangganan kalender akademik?', en: 'How do I subscribe to the academic calendar?' },
    a: [
      {
        id: 'Di halaman Kalender, klik "Tambah ke Google Kalender" pada feed yang kamu mau (Inti S1, Wisuda, atau Libur nasional). Google Kalender versi web terbuka dan meminta konfirmasi; setelah itu kalendernya muncul juga di HP. Ada juga tombol untuk Outlook dan Apple, serta "Salin alamat" untuk aplikasi lain. Feed hanya berisi tanggal akademik umum, tanpa data pribadi.',
        en: 'On the Calendar page, click "Add to Google Calendar" on the feed you want (S1 core, Graduation or National holidays). Google Calendar on the web opens and asks you to confirm; after that the calendar also shows on your phone. There are buttons for Outlook and Apple too, and "Copy address" for other apps. Feeds hold public academic dates only, nothing personal.',
      },
    ],
  },
  {
    id: 'langganan-terlambat',
    q: { id: 'Kenapa langganan di Google Calendar terlambat diperbarui?', en: 'Why is my Google Calendar subscription late?' },
    a: [
      {
        id: 'Google Calendar memperbarui kalender langganan dengan jadwalnya sendiri, bisa berjam-jam sampai sehari. Sulo tidak bisa mempercepatnya. Untuk tanggal terbaru, lihat halaman Kalender di dashboard.',
        en: 'Google Calendar refreshes subscribed calendars on its own schedule, from hours up to a day. Sulo cannot speed that up. For the latest dates, look at the Calendar page in the dashboard.',
      },
    ],
  },
];
