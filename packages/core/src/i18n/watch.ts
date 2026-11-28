// Words for "Pantau tugas baru" in the extension (1.1.0), Indonesian and
// English. The phone has its own words for the same feature (i18n/mobile.ts).

import type { Locale } from './index';

const id = {
  title: 'Pantau tugas baru',
  body: 'Sulo mengecek SIKOLA tiap 15 menit selama komputermu dipakai dan memberi tahu kalau ada tugas, tenggat, atau kabar baru.',
  session: 'Selama ini menyala, sesi SIKOLA-mu tetap aktif di browser ini.',
  // Settings: the card already says "Pantau tugas baru", so the switch says what it does.
  switchLabel: 'Cek SIKOLA tiap 15 menit',
  short: 'Juga saat kamu membuka Sulo. Sesi SIKOLA-mu tetap aktif di browser ini.',
  closed: 'Saat browser ditutup, Sulo tidak bisa mengecek. Ia menyusul begitu browser dibuka lagi.',
  stopped: 'Pantauan sedang dihentikan pengelola Sulo.',
  idleTitle: 'Sulo berhenti menjaga koneksi',
  idleBody: 'Sulo tidak dibuka 7 hari, jadi pantauan SIKOLA dan penjagaan sesi berhenti. Buka Sulo untuk menyalakannya lagi.',
  idleNote: 'Pantauan berhenti karena Sulo 7 hari tidak dibuka. Menyala lagi sekarang.',
  whatsNew: {
    title: 'Kabar SIKOLA lebih cepat',
    body: 'Nyalakan supaya Sulo mengecek SIKOLA tiap 15 menit. Selama menyala, sesi SIKOLA-mu tetap aktif di browser ini.',
  },
};

export type WatchWords = typeof id;

const en: WatchWords = {
  title: 'Watch for new tasks',
  body: 'Sulo checks SIKOLA every 15 minutes while your computer is in use and tells you about new tasks, deadlines and updates.',
  session: 'While this is on, your SIKOLA session stays active in this browser.',
  switchLabel: 'Check SIKOLA every 15 minutes',
  short: 'Also when you open Sulo. Your SIKOLA session stays active in this browser.',
  closed: 'While the browser is closed, Sulo cannot check. It catches up as soon as the browser opens again.',
  stopped: "Watching is paused by Sulo's maintainer.",
  idleTitle: 'Sulo stopped keeping connections',
  idleBody: 'Sulo was not opened for 7 days, so SIKOLA watching and session keeping stopped. Open Sulo to start them again.',
  idleNote: 'Watching stopped because Sulo was not opened for 7 days. It is on again now.',
  whatsNew: {
    title: 'SIKOLA news arrives faster',
    body: 'Turn it on and Sulo checks SIKOLA every 15 minutes. While it is on, your SIKOLA session stays active in this browser.',
  },
};

export function watchWords(locale: Locale): WatchWords {
  return locale === 'en' ? en : id;
}
