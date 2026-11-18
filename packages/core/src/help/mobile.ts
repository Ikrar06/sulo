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
        id: 'Kamu masuk di halaman SIKOLA sendiri, jadi Sulo tidak pernah melihat password-mu. Sesi login disimpan terenkripsi dengan kunci di Android Keystore, dan Sulo hanya menghubungi SIKOLA untuk membaca. Tidak ada iklan, pelacakan, atau server Sulo.',
        en: 'You sign in on SIKOLA’s own page, so Sulo never sees your password. The session is stored encrypted with a key in the Android Keystore, and Sulo only contacts SIKOLA to read. No ads, no tracking, no Sulo server.',
      },
    ],
  },
  {
    id: 'kapan-diperbarui',
    q: { id: 'Kapan data di Sulo diperbarui?', en: 'When does Sulo update its data?' },
    a: [
      {
        id: 'Saat kamu membuka aplikasi dan datanya lebih tua dari 15 menit, saat kamu menarik layar ke bawah, atau saat kamu mengetuk Perbarui. Jarak antarpembaruan paling cepat 2 menit. Sulo tidak memeriksa SIKOLA di latar belakang.',
        en: 'When you open the app and the data is older than 15 minutes, when you pull the screen down, or when you tap Update. Updates are at least 2 minutes apart. Sulo does not check SIKOLA in the background.',
      },
    ],
  },
  {
    id: 'masuk-lagi-hp',
    q: { id: 'Kenapa Sulo minta aku masuk lagi ke SIKOLA?', en: 'Why does Sulo ask me to sign in to SIKOLA again?' },
    a: [
      {
        id: 'Sesi SIKOLA berakhir sekitar dua jam setelah kamu terakhir aktif, dan Sulo tidak pernah memperpanjangnya secara buatan. Data terakhir tetap tampil; ketuk Masuk lagi untuk memperbarui.',
        en: 'A SIKOLA session ends about two hours after you were last active, and Sulo never keeps it alive artificially. The latest data stays on screen; tap Sign in again to update.',
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
  { id: 'pembaruan', title: { id: 'Pembaruan data', en: 'Updating data' }, entries: ['kapan-diperbarui', 'masuk-lagi-hp', 'sikola-berubah-hp', 'kabar-lama'] },
  { id: 'pengingat', title: { id: 'Pengingat', en: 'Reminders' }, entries: ['pengingat-hp'] },
  { id: 'tugas', title: { id: 'Mata kuliah dan tugas', en: 'Courses and tasks' }, entries: ['mata-kuliah-hp', 'tugas-tidak-muncul-hp'] },
  { id: 'presensi', title: { id: 'Presensi', en: 'Attendance' }, entries: ['presensi-diperbarui'] },
  { id: 'tentang', title: { id: 'Tentang Sulo', en: 'About Sulo' }, entries: ['resmi'] },
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
