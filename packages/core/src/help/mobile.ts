// Help for the phone app (M8c; the iPhone's own wording below, B3): the same plain words as the extension's
// FAQ (i18n/glossary.md, no "request"), answered for the phone. No guide
// videos here.

import { FAQ, type FaqEntry } from './content';
import { mobileOs } from '../i18n/os';

/** Extension answers that read the same on the phone. */
const SHARED = new Set(['kabar-lama', 'presensi-diperbarui', 'resmi', 'mkpk-belum-lulus', 'sipakamase-aman']);

const PHONE: FaqEntry[] = [
  {
    id: 'aman-hp',
    q: { id: 'Apakah Sulo aman di HP?', en: 'Is Sulo safe on my phone?' },
    a: [
      {
        id: 'Kamu masuk di halaman SIKOLA sendiri, jadi Sulo tidak pernah melihat password-mu. Sesi SIKOLA disimpan terenkripsi dengan kunci di Android Keystore, dan Sulo hanya membaca dari SIKOLA. Tidak ada iklan, pelacakan, atau server Sulo.',
        en: 'You sign in on SIKOLA’s own page, so Sulo never sees your password. The session is stored encrypted with a key in the Android Keystore, and Sulo only reads from SIKOLA. No ads, no tracking, no Sulo server.',
      },
    ],
  },
  {
    id: 'kapan-diperbarui',
    q: { id: 'Kapan data di Sulo diperbarui?', en: 'When does Sulo update its data?' },
    a: [
      {
        id: 'Saat kamu membuka aplikasi dan datanya lebih tua dari 15 menit, saat kamu menarik layar ke bawah, atau saat kamu mengetuk Perbarui. Paling cepat 5 menit sekali. Kalau "Pantau tugas baru" menyala, Sulo juga mengecek berkala di latar belakang (sekitar tiap 20 menit siang hari, tiap 110 menit malam hari).',
        en: 'When you open the app and the data is older than 15 minutes, when you pull the screen down, or when you tap Update. Updates are at least 5 minutes apart. With "Watch for new tasks" on, Sulo also checks regularly in the background (about every 20 minutes by day, every 110 minutes at night).',
      },
    ],
  },
  {
    id: 'masuk-lagi-hp',
    q: { id: 'Kenapa Sulo minta aku masuk lagi ke SIKOLA?', en: 'Why does Sulo ask me to sign in to SIKOLA again?' },
    a: [
      {
        id: 'Sesi SIKOLA berakhir setelah beberapa jam tanpa aktivitas (bisa sampai sekitar 8 jam, tergantung SIKOLA). Kalau "Pantau tugas baru" mati, Sulo tidak menjaga sesimu tetap aktif, jadi kamu diminta masuk lagi sesekali. Data terakhir tetap tampil; ketuk Masuk lagi untuk memperbarui. Kalau Ringkasan pagi menyala, tawaran masuk lagi ikut di dalamnya, paling banyak sekali sehari, untuk semua sumber yang sesinya habis (SIKOLA, Sipakamase, NEOSIA). Kalau mati, Sulo memberi tahu sekali saja.',
        en: 'A SIKOLA session ends after some hours without activity (up to about 8 hours, depending on SIKOLA). With "Watch for new tasks" off, Sulo doesn’t keep your session active, so it asks you to sign in now and then. The latest data stays on screen; tap Sign in again to update. With the Morning summary on, the offer to sign in again comes inside it, at most once a day, for every source whose session ended (SIKOLA, Sipakamase, NEOSIA). With it off, Sulo tells you once.',
      },
    ],
  },
  {
    id: 'seberapa-cepat-hp',
    q: { id: 'Seberapa cepat Sulo tahu ada tugas baru?', en: 'How soon does Sulo know about a new task?' },
    a: [
      {
        id: 'Kalau "Pantau tugas baru" menyala dan HP tidak menidurkan Sulo, sekitar 20 menit di siang hari (06.00-22.59) dan sekitar 110 menit di malam hari. Kalau mati, saat kamu membuka aplikasi, menarik layar, atau mengetuk Perbarui.',
        en: 'With "Watch for new tasks" on and the phone not putting Sulo to sleep, about 20 minutes by day (06:00 to 22:59) and about 110 minutes at night. With it off, when you open the app, pull down, or tap Update.',
      },
    ],
  },
  {
    id: 'masuk-lagi-pemantauan-hp',
    q: { id: 'Kenapa Sulo minta masuk lagi padahal pemantauan menyala?', en: 'Why does Sulo ask me to sign in again when watching is on?' },
    a: [
      {
        id: 'HP-mu menunda pengecekan Sulo terlalu lama (misalnya karena penghemat baterai), jadi sesi SIKOLA-mu berakhir. Masuk lagi, lalu izinkan Sulo berjalan di latar belakang di pengaturan aplikasi HP supaya tidak terulang.',
        en: 'Your phone held Sulo’s checks back for too long (a battery saver can do this), so your SIKOLA session ended. Sign in again, then allow Sulo to run in the background in the phone’s app settings so it doesn’t happen again.',
      },
    ],
  },
  {
    id: 'baterai-hp',
    q: { id: 'Apakah pemantauan boros baterai?', en: 'Does watching drain the battery?' },
    a: [
      {
        id: 'Dengan pemantauan menyala, Sulo bangun paling banyak sekitar 55 kali sehari: tiap 20 menit pukul 06.00-22.59 dan tiap 110 menit di malam hari. Setiap kali hanya satu permintaan kecil ke SIKOLA, lalu tidur lagi; tidak ada yang berjalan terus di latar belakang.',
        en: 'With watching on, Sulo wakes at most about 55 times a day: every 20 minutes from 06:00 to 22:59 and every 110 minutes at night. Each time it sends one small request to SIKOLA, then sleeps again. Nothing keeps running in the background.',
      },
      {
        id: 'Saat Penghemat baterai menyala, Sulo mengecek tiap 110 menit, siang maupun malam, tanpa mengecek materi mata kuliah, dan kembali normal saat penghemat dimatikan. Kalau ingin lebih hemat lagi, matikan pemantauan; Sulo tetap memperbarui saat aplikasi dibuka.',
        en: 'With Battery Saver on, Sulo checks every 110 minutes, day and night, without looking at course materials, and goes back to normal when the saver is off. To save even more, turn watching off; Sulo still updates when you open the app.',
      },
    ],
  },
  {
    id: 'pemantauan-dijeda-hp',
    q: { id: 'Kenapa pemantauan berhenti sendiri?', en: 'Why did watching stop by itself?' },
    a: [
      {
        id: 'Pemantauan dijeda kalau Sulo tidak dibuka selama 7 hari, supaya tidak terus mengecek SIKOLA atas namamu tanpa kamu sadari. Kamu mendapat satu notifikasi "Pemantauan dijeda"; buka Sulo dan pemantauan jalan lagi.',
        en: 'Watching pauses when Sulo hasn’t been opened for 7 days, so it doesn’t keep checking SIKOLA for you without you noticing. You get one "Watching is paused" notification; open Sulo and it starts again.',
      },
      {
        id: 'Pemantauan juga berhenti mengecek kalau pengelola mematikannya lewat pengaturan jarak jauh, atau kalau pengaturan itu tidak terbaca selama 72 jam. Sulo membacanya lagi tiap 6 jam dan melanjutkan sendiri begitu boleh.',
        en: 'Watching also stops checking when the developer turns it off through the remote settings, or when those settings can’t be read for 72 hours. Sulo reads them again every 6 hours and resumes on its own once allowed.',
      },
    ],
  },
  {
    id: 'webview-hp',
    q: { id: 'Sulo tampil kosong atau minta pembaruan', en: 'Sulo shows a blank screen or asks for an update' },
    a: [
      {
        id: 'Sulo memakai Android System WebView bawaan HP untuk menampilkan layarnya, dan butuh versi 111 atau lebih baru. Versi yang lebih lama menampilkan halaman "Perlu pembaruan"; selama itu Sulo tidak mengecek SIKOLA sama sekali.',
        en: 'Sulo uses the phone’s Android System WebView to draw its screens and needs version 111 or newer. Older versions show the "Update needed" page; until then Sulo doesn’t check SIKOLA at all.',
      },
      {
        id: 'Langkahnya: ketuk Perbarui di halaman itu, atau buka Play Store, cari "Android System WebView", lalu ketuk Perbarui. Perbarui juga Google Chrome kalau ada. Setelah itu tutup Sulo sepenuhnya dan buka lagi.',
        en: 'To fix it: tap Update on that page, or open the Play Store, search for "Android System WebView" and tap Update. Update Google Chrome too if it is installed. Then close Sulo completely and open it again.',
      },
    ],
  },
  {
    id: 'email-sikola-hp',
    q: { id: 'Bisakah SIKOLA mengirim email juga?', en: 'Can SIKOLA send me email too?' },
    a: [
      {
        id: 'Bisa, sebagai pelengkap Sulo. Di SIKOLA, buka menu profil, Preferensi, lalu Preferensi notifikasi, dan nyalakan kolom Email untuk jenis yang kamu mau (misalnya tugas dan forum). Tombol di Lainnya, Pengaturan, Notifikasi membuka halaman preferensi SIKOLA di browser. Sulo tidak mengubah pengaturan itu.',
        en: 'Yes, alongside Sulo. On SIKOLA, open the profile menu, Preferences, then Notification preferences, and turn on the Email column for the kinds you want (assignments and forums, for example). The button under More, Settings, Notifications opens SIKOLA’s preferences page in your browser. Sulo doesn’t change those settings.',
      },
    ],
  },
  {
    id: 'pengingat-hp',
    q: { id: 'Kenapa pengingat tidak muncul?', en: 'Why don’t reminders show up?' },
    a: [
      {
        id: 'Pastikan notifikasi Sulo diizinkan di Pengaturan HP, lalu cek jam tenang di Lainnya, Pengaturan. Pengingat dijadwalkan untuk 7 hari ke depan dari data terakhir, jadi buka Sulo sesekali supaya jadwalnya ikut terbaru. Waktunya bisa bergeser beberapa menit karena Android menghemat baterai.',
        en: 'Make sure Sulo’s notifications are allowed in the phone’s Settings, then check quiet hours under More, Settings. Reminders are scheduled for the next 7 days from the latest data, so open Sulo now and then to keep them current. They can be a few minutes late because Android saves battery.',
      },
    ],
  },
  {
    id: 'neosia-hp',
    q: { id: 'Bagaimana Sulo membaca data dari NEOSIA?', en: 'How does Sulo read data from NEOSIA?' },
    a: [
      {
        id: 'Hanya dari halaman NEOSIA yang kamu buka sendiri lewat Sulo. Sulo tidak pernah meminta apa pun ke NEOSIA; saat halaman itu memuat datanya, Sulo menyalin bagian yang dibutuhkan (jadwal, kesiapan KRS, nilai) dan membuang data pribadi seperti NIM, alamat, dan kontak. Semua disimpan terenkripsi di HP ini, terpisah dari sesi SIKOLA.',
        en: 'Only from NEOSIA pages you open yourself through Sulo. Sulo never asks NEOSIA for anything; when such a page loads its data, Sulo copies the parts it needs (schedule, KRS readiness, grades) and drops personal data such as your student number, address and contacts. Everything is stored encrypted on this phone, separately from your SIKOLA session.',
      },
      {
        id: 'Kamu masuk di halaman NEOSIA sendiri; Sulo tidak membaca password maupun token login NEOSIA. Jadwal dan nilai menunjukkan kapan terakhir diperbarui. Untuk memperbaruinya, ketuk "Perbarui dari NEOSIA": Sulo hanya membuka halaman NEOSIA itu.',
        en: 'You sign in on NEOSIA’s own page; Sulo reads neither your password nor NEOSIA’s sign-in token. The schedule and grades show when they were last updated. To update them, tap "Update from NEOSIA": Sulo only opens that NEOSIA page.',
      },
    ],
  },
  {
    id: 'nilai-tersembunyi-hp',
    q: { id: 'Kenapa nilai dan IPK tidak tampil?', en: 'Why are my grades and GPA hidden?' },
    a: [
      {
        id: 'Nilai dan IPK tersembunyi sampai kamu menyalakan Tampilkan nilai di Lainnya, Pengaturan, NEOSIA. Mode privasi juga menyamarkannya. Nilai tidak pernah masuk notifikasi, ekspor, atau laporan bug. Simulasi IPK hanya perkiraan; IPK resmi tetap yang di NEOSIA.',
        en: 'Grades and GPA stay hidden until you turn on Show grades in More, Settings, NEOSIA. Privacy mode masks them too. Grades never appear in notifications, exports or bug reports. The GPA simulation is an estimate; your official GPA is the one in NEOSIA.',
      },
    ],
  },
  {
    id: 'sesi-neosia-hp',
    q: { id: 'Kenapa NEOSIA memintaku masuk lagi?', en: 'Why does NEOSIA ask me to sign in again?' },
    a: [
      {
        id: 'Sesi NEOSIA disimpan aplikasi NEOSIA sendiri, dan Sulo tidak bisa memperpanjangnya. "Perbarui NEOSIA otomatis" membuka NEOSIA saat kamu membuka Sulo, jadi kamu lebih cepat tahu kalau sesinya habis. Saat NEOSIA memintamu masuk lagi, ketuk Masuk NEOSIA. Data terakhir tetap tampil. Putuskan NEOSIA di Pengaturan menghapus semua data NEOSIA dan sesi NEOSIA di HP ini.',
        en: 'NEOSIA keeps its own session, and Sulo cannot extend it. "Update NEOSIA automatically" opens NEOSIA when you open Sulo, so you learn sooner when the session has ended. When NEOSIA asks you to sign in, tap Sign in to NEOSIA. The last data stays on screen. Disconnect NEOSIA in Settings deletes all NEOSIA data and the NEOSIA sign-in on this phone.',
      },
    ],
  },
  {
    id: 'mata-kuliah-hp',
    q: { id: 'Bagaimana cara memilih mata kuliah yang dipantau?', en: 'How do I choose the courses Sulo follows?' },
    a: [
      { id: 'Buka Lainnya, Mata kuliah, lalu ketuk tombol di kanan mata kuliah untuk memantau atau berhenti memantaunya. Di sana juga bisa mengganti nama dan warna.', en: 'Open More, Courses, and use the switch on the right of a course to follow it or stop. You can rename courses and change their colors there too.' },
    ],
  },
  {
    id: 'akun-lain-hp',
    q: { id: 'Apa yang terjadi kalau aku masuk dengan akun SIKOLA lain?', en: 'What happens if I sign in with another SIKOLA account?' },
    a: [
      {
        id: 'Sulo langsung menyembunyikan data akun sebelumnya dan berhenti mengingatkan, lalu menanyakan akun mana yang dipakai. Data akun sebelumnya baru dihapus setelah kamu setuju.',
        en: 'Sulo hides the previous account’s data at once and stops reminding, then asks which account to use. The previous account’s data is only deleted once you agree.',
      },
    ],
  },
  {
    id: 'hapus-data-hp',
    q: { id: 'Bagaimana cara menghapus semua data Sulo?', en: 'How do I delete all of Sulo’s data?' },
    a: [
      {
        id: 'Buka Lainnya, Pengaturan, lalu Keluar dan hapus data. Sesi, semua data, dan pengingat terjadwal di HP ini terhapus. Menghapus aplikasi juga menghapus semuanya. Data di SIKOLA tidak tersentuh.',
        en: 'Open More, Settings, then Sign out and delete data. The session, all data and scheduled reminders on this phone are deleted. Uninstalling the app deletes everything too. Nothing on SIKOLA is touched.',
      },
    ],
  },
  {
    id: 'tugas-tidak-muncul-hp',
    q: { id: 'Kenapa ada tugas yang tidak muncul?', en: 'Why is a task missing?' },
    a: [
      {
        id: 'Biasanya karena salah satu ini: mata kuliahnya belum dipantau (Lainnya, Mata kuliah); tugasnya belum dibuka dosen atau tidak punya tenggat di kalender SIKOLA; tenggatnya lebih dari 90 hari lagi; atau kamu sudah menandainya selesai. Tugas yang sudah dikumpulkan bisa hilang dari kalender SIKOLA, dan Sulo menyebutnya "mungkin sudah dikumpulkan".',
        en: 'Usually one of these: the course isn’t followed (More, Courses); the lecturer hasn’t opened the task yet or it has no due date in the SIKOLA calendar; it is due more than 90 days away; or you marked it as done. Handed-in tasks can drop out of the SIKOLA calendar, and Sulo calls them "probably handed in".',
      },
    ],
  },
  {
    id: 'nilai-tugas-hp',
    q: { id: 'Dari mana nilai tugas di tab Tugas?', en: 'Where do the task grades in Tugas come from?' },
    a: [
      {
        id: 'Dari halaman nilai tiap mata kuliah yang dipantau di SIKOLA. Sulo membacanya saat kamu membuka Tugas (paling sering sekali tiap 10 menit) dan saat memperbarui. Yang dibaca hanya nilai, tidak pernah komentar dosen.',
        en: 'From the grades page of each course you follow on SIKOLA. Sulo reads it when you open Tugas (at most once every 10 minutes) and when it updates. It reads the grade only, never the lecturer’s comments.',
      },
      {
        id: 'Tugas yang sudah dinilai otomatis ditandai selesai, termasuk tugas lama yang tidak ada di kalender SIKOLA; lihat di saringan Selesai dan Dinilai. Angkanya tersembunyi sampai kamu mengetuk Tampilkan nilai, dan tidak pernah masuk notifikasi.',
        en: 'A graded task is marked as done on its own, old ones missing from the SIKOLA calendar included; see the Done and Graded filters. The numbers stay hidden until you tap Show grades, and never appear in notifications.',
      },
    ],
  },
  {
    id: 'sikola-berubah-hp',
    q: { id: 'Bagaimana kalau SIKOLA berubah?', en: 'What if SIKOLA changes?' },
    a: [
      {
        id: 'Kalau Sulo tidak lagi bisa membaca SIKOLA dengan benar, Sulo menuliskannya di layar dan tidak menebak isinya. Data terakhir tetap tampil. Buka Lainnya, Pengaturan, Salin info untuk laporan bug, lalu kirim teksnya ke pengelola; teks itu tidak memuat data pribadi.',
        en: 'If Sulo can no longer read SIKOLA properly, it says so on screen and doesn’t guess. Your latest data stays. Open More, Settings, Copy info for a bug report, and send the text to the developer; it holds no personal data.',
      },
    ],
  },
];

/** The Android app's FAQ: phone answers first, then the shared ones in their usual order. */
export const MOBILE_FAQ: FaqEntry[] = [...PHONE, ...FAQ.filter((e) => SHARED.has(e.id))];

/** Android-only answers the iPhone leaves out: battery settings, Android System WebView, the worker's pauses. */
const ANDROID_ONLY = new Set(['masuk-lagi-pemantauan-hp', 'baterai-hp', 'webview-hp', 'pemantauan-dijeda-hp']);

/** The iPhone's own answers where Android's name the Keystore, background watching or Android's settings (B3). */
const IPHONE_ANSWERS: Record<string, FaqEntry['a']> = {
  'aman-hp': [
    {
      id: 'Kamu masuk di halaman SIKOLA sendiri, jadi Sulo tidak pernah melihat password-mu. Sesi SIKOLA disimpan di Keychain iPhone, dan Sulo hanya membaca dari SIKOLA. Tidak ada iklan, pelacakan, atau server Sulo.',
      en: 'You sign in on SIKOLA’s own page, so Sulo never sees your password. The SIKOLA session is kept in the iPhone’s Keychain, and Sulo only reads from SIKOLA. No ads, no tracking, no Sulo server.',
    },
  ],
  'kapan-diperbarui': [
    {
      id: 'Saat kamu membuka aplikasi dan datanya lebih tua dari 15 menit, saat kamu menarik layar ke bawah, atau saat kamu mengetuk Perbarui. Paling cepat 5 menit sekali. Di iPhone tidak ada pemantauan tugas baru di latar belakang.',
      en: 'When you open the app and the data is older than 15 minutes, when you pull the screen down, or when you tap Update. At most once every 5 minutes. On iPhone there is no watching for new tasks in the background.',
    },
  ],
  'seberapa-cepat-hp': [
    {
      id: 'Begitu kamu membuka Sulo. iPhone tidak memberi aplikasi seperti Sulo waktu tetap di latar belakang, jadi tugas baru terlihat saat Sulo dibuka. Pengingat tenggat tetap muncul dari data terakhir.',
      en: 'As soon as you open Sulo. The iPhone gives apps like Sulo no fixed time in the background, so new tasks show when Sulo is opened. Deadline reminders still come from the latest data.',
    },
  ],
  'masuk-lagi-hp': [
    {
      id: 'Sesi SIKOLA berakhir setelah beberapa jam tanpa aktivitas (bisa sampai sekitar 8 jam). Di iPhone, Sulo hanya bisa menjaganya saat iPhone memberi waktu di latar belakang, jadi kamu bisa cukup sering diminta masuk lagi. Data terakhir tetap tampil; ketuk Masuk lagi untuk memperbarui.',
      en: 'A SIKOLA session ends after some hours without activity (up to about 8 hours). On iPhone, Sulo can only keep it when the iPhone gives it time in the background, so you may be asked to sign in again fairly often. The latest data stays on screen; tap Sign in again to update.',
    },
  ],
  'hapus-data-hp': [
    {
      id: 'Buka Lainnya, Pengaturan, lalu Keluar dan hapus data. Sesi, semua data, dan pengingat terjadwal di iPhone ini terhapus. Lakukan ini sebelum menghapus aplikasi: iPhone menyimpan isi Keychain setelah aplikasi dihapus, dan Sulo baru membersihkannya saat dipasang lagi. Data di SIKOLA tidak tersentuh.',
      en: 'Open More, Settings, then Sign out and delete data. The session, all data and the scheduled reminders on this iPhone are deleted. Do this before deleting the app: the iPhone keeps Keychain items after an app is deleted, and Sulo clears them only when it is installed again. Nothing on SIKOLA is touched.',
    },
  ],
  'pengingat-hp': [
    {
      id: 'Pastikan notifikasi Sulo diizinkan di Pengaturan iPhone, Notifikasi, Sulo, dan cek mode Fokus. Cek juga jam tenang di Lainnya, Pengaturan. Pengingat dijadwalkan untuk 7 hari ke depan dari data terakhir, jadi buka Sulo sesekali supaya jadwalnya ikut terbaru.',
      en: 'Make sure Sulo’s notifications are allowed in iPhone Settings, Notifications, Sulo, and check your Focus mode. Check the quiet hours in More, Settings too. Reminders are scheduled for the next 7 days from the latest data, so open Sulo now and then to keep the schedule current.',
    },
  ],
};

/** Questions only the iPhone has: the weekly refresh. */
const IPHONE_ONLY: FaqEntry[] = [
  {
    id: 'segarkan-7-hari',
    q: { id: 'Kenapa Sulo harus disegarkan tiap 7 hari?', en: 'Why does Sulo need a refresh every 7 days?' },
    a: [
      {
        id: 'Sulo di iPhone dipasang lewat laptop dengan Apple ID gratis, dan Apple hanya membiarkan aplikasi seperti itu berjalan 7 hari. Sideloadly bisa menyegarkannya otomatis kalau laptopmu menyala dan iPhone tersambung ke WiFi yang sama atau kabel. Sehari sebelumnya, Sulo memberi tahu.',
        en: 'Sulo on iPhone is installed from a laptop with a free Apple ID, and Apple lets such apps run for 7 days. Sideloadly can refresh it on its own when your laptop is on and the iPhone is on the same Wi-Fi or a cable. Sulo tells you the day before.',
      },
    ],
  },
  {
    id: 'tidak-bisa-dibuka-iphone',
    q: { id: 'Sulo tidak bisa dibuka di iPhone', en: 'Sulo does not open on my iPhone' },
    a: [
      {
        id: 'Kemungkinan masa 7 harinya habis. Segarkan lewat Sideloadly di laptop, dengan Apple ID yang sama seperti saat memasang. Datamu tidak hilang.',
        en: 'Most likely its 7 days ran out. Refresh it with Sideloadly on your laptop, with the same Apple ID you installed it with. Your data stays.',
      },
    ],
  },
];

/** The help this phone shows: Android's, or the iPhone's own wording (i18n/os.ts). */
export function mobileFaq(): FaqEntry[] {
  if (mobileOs() !== 'ios') return MOBILE_FAQ;
  const own = MOBILE_FAQ.filter((e) => !ANDROID_ONLY.has(e.id)).map((e) => (IPHONE_ANSWERS[e.id] ? { ...e, a: IPHONE_ANSWERS[e.id]! } : e));
  return [...own, ...IPHONE_ONLY];
}

/** Where the iPhone's own questions sit (the Android ones it hides simply drop out of their groups). */
const IPHONE_TOPIC_EXTRA: Readonly<Record<string, readonly string[]>> = { tentang: ['segarkan-7-hari', 'tidak-bisa-dibuka-iphone'] };

/** Bantuan's groups on the phone, in order; every MOBILE_FAQ entry is in exactly one (tested). */
export const MOBILE_FAQ_TOPICS = [
  { id: 'privasi', title: { id: 'Keamanan dan privasi', en: 'Security and privacy' }, entries: ['aman-hp', 'akun-lain-hp', 'hapus-data-hp'] },
  { id: 'pembaruan', title: { id: 'Pembaruan data', en: 'Updating data' }, entries: ['kapan-diperbarui', 'seberapa-cepat-hp', 'masuk-lagi-hp', 'masuk-lagi-pemantauan-hp', 'sikola-berubah-hp', 'kabar-lama'] },
  { id: 'pengingat', title: { id: 'Pengingat', en: 'Reminders' }, entries: ['pengingat-hp', 'baterai-hp', 'pemantauan-dijeda-hp', 'email-sikola-hp'] },
  { id: 'tugas', title: { id: 'Mata kuliah dan tugas', en: 'Courses and tasks' }, entries: ['mata-kuliah-hp', 'tugas-tidak-muncul-hp', 'nilai-tugas-hp'] },
  { id: 'presensi', title: { id: 'Presensi', en: 'Attendance' }, entries: ['presensi-diperbarui'] },
  { id: 'neosia', title: { id: 'Jadwal dan nilai dari NEOSIA', en: 'Schedule and grades from NEOSIA' }, entries: ['neosia-hp', 'nilai-tersembunyi-hp', 'sesi-neosia-hp'] },
  { id: 'mkpk', title: { id: 'MKPK dan Sipakamase', en: 'MKPK and Sipakamase' }, entries: ['mkpk-belum-lulus', 'sipakamase-aman'] },
  { id: 'tentang', title: { id: 'Tentang Sulo', en: 'About Sulo' }, entries: ['webview-hp', 'resmi'] },
] as const;

export interface FaqGroup {
  id: string;
  title: string;
  entries: FaqEntry[];
}

/** Lowercase without accents, so "Apakah" matches "apakah" and "kabar" matches "Kabar". */
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** The grouped FAQ in one language, keeping only entries whose question or answer holds every word of the query. Empty groups drop out. */
export function searchFaq(query: string, lang: 'id' | 'en', faq: readonly FaqEntry[] = mobileFaq()): FaqGroup[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const byId = new Map(faq.map((e) => [e.id, e]));
  return MOBILE_FAQ_TOPICS.map((t) => ({
    id: t.id,
    title: t.title[lang],
    entries: [...(mobileOs() === 'ios' ? (IPHONE_TOPIC_EXTRA[t.id] ?? []) : []), ...t.entries]
      .map((id) => byId.get(id))
      .filter((e): e is FaqEntry => e !== undefined)
      .filter((e) => {
        const text = fold([e.q[lang], ...e.a.map((a) => a[lang])].join(' '));
        return words.every((w) => text.includes(w));
      }),
  })).filter((g) => g.entries.length > 0);
}
