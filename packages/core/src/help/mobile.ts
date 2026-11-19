// Help for the Android app (M8c): the same plain words as the extension's
// FAQ (i18n/glossary.md, no "request"), answered for the phone. No guide
// videos here.

import { FAQ, type FaqEntry } from './content';

/** Extension answers that read the same on the phone. */
const SHARED = new Set(['kabar-lama', 'presensi-diperbarui', 'resmi']);

const PHONE: FaqEntry[] = [
  {
    id: 'aman-hp',
    q: { id: 'Apakah Sulo aman di HP?', en: 'Is Sulo safe on my phone?' },
    a: [
      {
        id: 'Kamu masuk di halaman SIKOLA sendiri, jadi Sulo tidak pernah melihat password-mu. Sesi login disimpan terenkripsi dengan kunci di Android Keystore, dan Sulo hanya membaca dari SIKOLA. Tidak ada iklan, pelacakan, atau server Sulo.',
        en: 'You sign in on SIKOLA’s own page, so Sulo never sees your password. The session is stored encrypted with a key in the Android Keystore, and Sulo only reads from SIKOLA. No ads, no tracking, no Sulo server.',
      },
    ],
  },
  {
    id: 'kapan-diperbarui',
    q: { id: 'Kapan data di Sulo diperbarui?', en: 'When does Sulo update its data?' },
    a: [
      {
        id: 'Saat kamu membuka aplikasi dan datanya lebih tua dari 15 menit, saat kamu menarik layar ke bawah, atau saat kamu mengetuk Perbarui. Jarak antarpembaruan paling cepat 2 menit. Kalau "Pantau tugas baru" menyala, Sulo juga mengecek berkala di latar belakang (sekitar tiap 20 menit siang hari, tiap 60 menit malam hari).',
        en: 'When you open the app and the data is older than 15 minutes, when you pull the screen down, or when you tap Update. Updates are at least 2 minutes apart. With "Watch for new tasks" on, Sulo also checks regularly in the background (about every 20 minutes by day, every 60 minutes at night).',
      },
    ],
  },
  {
    id: 'masuk-lagi-hp',
    q: { id: 'Kenapa Sulo minta aku masuk lagi ke SIKOLA?', en: 'Why does Sulo ask me to sign in to SIKOLA again?' },
    a: [
      {
        id: 'Sesi SIKOLA berakhir sekitar dua jam setelah kamu terakhir aktif. Kalau "Pantau tugas baru" mati, Sulo tidak menjaga sesimu tetap aktif, jadi kamu diminta masuk lagi sesekali. Data terakhir tetap tampil; ketuk Masuk lagi untuk memperbarui.',
        en: 'A SIKOLA session ends about two hours after you were last active. With "Watch for new tasks" off, Sulo does not keep your session active, so it asks you to sign in now and then. The latest data stays on screen; tap Sign in again to update.',
      },
    ],
  },
  {
    id: 'tertutup-saat-memperbarui',
    q: { id: 'Kenapa sesi berakhir setelah Sulo kututup saat memperbarui?', en: 'Why did my session end after I closed Sulo while it was updating?' },
    a: [
      {
        id: 'SIKOLA mengakhiri sesi kalau sambungan dari HP terputus di tengah jalan, misalnya saat Sulo ditutup paksa ketika sedang memperbarui. Sulo menjaga agar pembaruan yang sedang berjalan tetap selesai walau Sulo kamu geser dari daftar aplikasi terbaru, tetapi tutup paksa dari pengaturan HP tetap memutusnya. Kalau itu terjadi, data terakhir tetap tampil; ketuk Masuk lagi untuk melanjutkan.',
        en: 'SIKOLA ends the session when the phone’s connection to it is cut off midway, for example when Sulo is force-closed while it is updating. Sulo keeps an update that is running going even if you swipe Sulo away from recent apps, but force-stopping it from the phone’s settings still cuts it off. If that happens, the latest data stays on screen; tap Sign in again to continue.',
      },
    ],
  },
  {
    id: 'seberapa-cepat-hp',
    q: { id: 'Seberapa cepat Sulo tahu ada tugas baru?', en: 'How soon does Sulo know about a new task?' },
    a: [
      {
        id: 'Kalau "Pantau tugas baru" menyala dan HP tidak menidurkan Sulo, sekitar 20 menit di siang hari (06.00-22.59) dan sekitar satu jam di malam hari. Kalau mati, saat kamu membuka aplikasi, menarik layar, atau mengetuk Perbarui.',
        en: 'With "Watch for new tasks" on and the phone not putting Sulo to sleep, about 20 minutes by day (06.00-22.59) and about an hour at night. With it off, when you open the app, pull down, or tap Update.',
      },
    ],
  },
  {
    id: 'masuk-lagi-pemantauan-hp',
    q: { id: 'Kenapa Sulo minta masuk lagi padahal pemantauan menyala?', en: 'Why does Sulo ask me to sign in again when watching is on?' },
    a: [
      {
        id: 'HP-mu menunda pengecekan terlalu lama (misalnya penghemat baterai), sehingga lebih dari dua jam tidak ada cek dan login SIKOLA berakhir. Masuk lagi, lalu izinkan Sulo berjalan di latar belakang di pengaturan aplikasi HP supaya tidak terulang.',
        en: 'Your phone held the checks back too long (a battery saver, for example), so more than two hours passed without one and the SIKOLA sign-in ended. Sign in again, then allow Sulo to run in the background in the phone’s app settings so it does not happen again.',
      },
    ],
  },
  {
    id: 'baterai-hp',
    q: { id: 'Apakah pemantauan boros baterai?', en: 'Does watching drain the battery?' },
    a: [
      {
        id: 'Dengan pemantauan menyala, Sulo bangun paling banyak sekitar 58 kali sehari: tiap 20 menit pukul 06.00-22.59 dan tiap jam di malam hari. Setiap kali hanya satu permintaan kecil ke SIKOLA, lalu tidur lagi; tidak ada yang berjalan terus di latar belakang.',
        en: 'With watching on, Sulo wakes at most about 58 times a day: every 20 minutes from 06.00 to 22.59 and every hour at night. Each time it sends one small request to SIKOLA and sleeps again; nothing keeps running in the background.',
      },
      {
        id: 'Saat Penghemat baterai menyala, Sulo mengecek sekali per jam, siang maupun malam, tanpa memeriksa materi mata kuliah, dan kembali normal saat penghemat dimatikan. Kalau ingin lebih hemat lagi, matikan pemantauan; Sulo tetap memperbarui saat aplikasi dibuka.',
        en: 'With Battery Saver on, Sulo checks once an hour, day and night, without looking at course materials, and goes back to normal when the saver is off. To save even more, turn watching off; Sulo still updates when you open the app.',
      },
    ],
  },
  {
    id: 'pemantauan-dijeda-hp',
    q: { id: 'Kenapa pemantauan berhenti sendiri?', en: 'Why did watching stop by itself?' },
    a: [
      {
        id: 'Pemantauan dijeda kalau Sulo tidak dibuka selama 7 hari, supaya tidak terus mengecek SIKOLA atas namamu tanpa kamu sadari. Kamu mendapat satu notifikasi "Pemantauan dijeda"; buka Sulo dan pemantauan jalan lagi.',
        en: 'Watching pauses when Sulo has not been opened for 7 days, so it does not keep checking SIKOLA for you without you noticing. You get one "Watching is paused" notification; open Sulo and it starts again.',
      },
      {
        id: 'Pemantauan juga berhenti mengecek kalau pengelola mematikannya lewat pengaturan jarak jauh, atau kalau pengaturan itu tidak terbaca selama 72 jam. Sulo membacanya lagi tiap 6 jam dan melanjutkan sendiri begitu boleh.',
        en: 'Watching also stops checking when the maintainer turns it off through the remote settings, or when those settings cannot be read for 72 hours. Sulo reads them again every 6 hours and resumes on its own once allowed.',
      },
    ],
  },
  {
    id: 'webview-hp',
    q: { id: 'Sulo tampil kosong atau minta pembaruan', en: 'Sulo shows a blank screen or asks for an update' },
    a: [
      {
        id: 'Sulo memakai Android System WebView bawaan HP untuk menampilkan layarnya, dan butuh versi 111 atau lebih baru. Versi yang lebih lama menampilkan halaman "Perlu pembaruan"; selama itu Sulo tidak mengecek SIKOLA sama sekali.',
        en: 'Sulo uses the phone’s Android System WebView to draw its screens and needs version 111 or newer. Older versions show the "Update needed" page; until then Sulo does not check SIKOLA at all.',
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
        en: 'Yes, alongside Sulo. On SIKOLA, open the profile menu, Preferences, then Notification preferences, and turn on the Email column for the kinds you want (assignments and forums, for example). The button under More, Settings, Notifications opens SIKOLA’s preferences page in your browser. Sulo does not change those settings.',
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
    id: 'mata-kuliah-hp',
    q: { id: 'Bagaimana cara memilih mata kuliah yang dipantau?', en: 'How do I choose the courses Sulo follows?' },
    a: [
      { id: 'Buka Lainnya, Mata kuliah, lalu nyalakan atau matikan Dipantau. Di sana juga bisa mengganti nama dan warna.', en: 'Open More, Courses, and turn Followed on or off. You can rename courses and change their colors there too.' },
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
        en: 'Open More, Settings, then Sign out and delete data. The session, all data and scheduled reminders on this phone are deleted. Uninstalling the app deletes everything too. Nothing on SIKOLA changes.',
      },
    ],
  },
  {
    id: 'tugas-tidak-muncul-hp',
    q: { id: 'Kenapa ada tugas yang tidak muncul?', en: 'Why is a task missing?' },
    a: [
      {
        id: 'Biasanya karena salah satu ini: mata kuliahnya belum dipantau (Lainnya, Mata kuliah); tugasnya belum dibuka dosen atau tidak punya tenggat di kalender SIKOLA; tenggatnya lebih dari 90 hari lagi; atau kamu sudah menandainya selesai. Tugas yang sudah dikumpulkan bisa hilang dari kalender SIKOLA, dan Sulo menyebutnya "mungkin sudah dikumpulkan".',
        en: 'Usually one of these: the course is not followed (More, Courses); the lecturer has not opened the task yet or it has no due date in the SIKOLA calendar; it is due more than 90 days away; or you marked it as done. Handed-in tasks can drop out of the SIKOLA calendar, and Sulo calls them "probably handed in".',
      },
    ],
  },
  {
    id: 'sikola-berubah-hp',
    q: { id: 'Bagaimana kalau SIKOLA berubah?', en: 'What if SIKOLA changes?' },
    a: [
      {
        id: 'Kalau Sulo tidak lagi bisa membaca SIKOLA dengan benar, Sulo menuliskannya di layar dan tidak menebak isinya. Data terakhir tetap tampil. Buka Lainnya, Pengaturan, Salin info untuk laporan bug, lalu kirim teksnya ke pengelola; teks itu tidak memuat data pribadi.',
        en: 'If Sulo can no longer read SIKOLA properly, it says so on screen and does not guess. Your latest data stays. Open More, Settings, Copy info for a bug report, and send the text to the maintainer; it holds no personal data.',
      },
    ],
  },
];

/** The Android app's FAQ: phone answers first, then the shared ones in their usual order. */
export const MOBILE_FAQ: FaqEntry[] = [...PHONE, ...FAQ.filter((e) => SHARED.has(e.id))];

/** Bantuan's groups on the phone, in order; every MOBILE_FAQ entry is in exactly one (tested). */
export const MOBILE_FAQ_TOPICS = [
  { id: 'privasi', title: { id: 'Keamanan dan privasi', en: 'Security and privacy' }, entries: ['aman-hp', 'akun-lain-hp', 'hapus-data-hp'] },
  { id: 'pembaruan', title: { id: 'Pembaruan data', en: 'Updating data' }, entries: ['kapan-diperbarui', 'seberapa-cepat-hp', 'masuk-lagi-hp', 'tertutup-saat-memperbarui', 'masuk-lagi-pemantauan-hp', 'sikola-berubah-hp', 'kabar-lama'] },
  { id: 'pengingat', title: { id: 'Pengingat', en: 'Reminders' }, entries: ['pengingat-hp', 'baterai-hp', 'pemantauan-dijeda-hp', 'email-sikola-hp'] },
  { id: 'tugas', title: { id: 'Mata kuliah dan tugas', en: 'Courses and tasks' }, entries: ['mata-kuliah-hp', 'tugas-tidak-muncul-hp'] },
  { id: 'presensi', title: { id: 'Presensi', en: 'Attendance' }, entries: ['presensi-diperbarui'] },
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
export function searchFaq(query: string, lang: 'id' | 'en', faq: readonly FaqEntry[] = MOBILE_FAQ): FaqGroup[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const byId = new Map(faq.map((e) => [e.id, e]));
  return MOBILE_FAQ_TOPICS.map((t) => ({
    id: t.id,
    title: t.title[lang],
    entries: t.entries
      .map((id) => byId.get(id))
      .filter((e): e is FaqEntry => e !== undefined)
      .filter((e) => {
        const text = fold([e.q[lang], ...e.a.map((a) => a[lang])].join(' '));
        return words.every((w) => text.includes(w));
      }),
  })).filter((g) => g.entries.length > 0);
}
