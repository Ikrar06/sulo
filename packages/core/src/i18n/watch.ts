// Words for "Pantau tugas baru" in the extension (1.1.0), Indonesian and
// English. The phone has its own words for the same feature (i18n/mobile.ts).

import type { Locale } from './index';

const id = {
  title: 'Pantau tugas baru',
  body: 'Sulo mengecek SIKOLA tiap 15 menit selama komputermu dipakai, dan tiap kali kamu membuka Sulo, lalu memberi tahu kalau ada tugas, tenggat, atau kabar baru.',
  session: 'Selama ini menyala, sesi SIKOLA-mu tetap aktif di browser ini.',
  closed: 'Saat browser ditutup, Sulo tidak bisa mengecek. Ia menyusul begitu browser dibuka lagi.',
  stopped: 'Pantauan sedang dihentikan pengelola Sulo.',
  whatsNew: {
    title: 'Kabar SIKOLA lebih cepat',
    body: 'Nyalakan Pantau tugas baru supaya Sulo mengecek SIKOLA tiap 15 menit dan tiap kali kamu membuka Sulo. Selama menyala, sesi SIKOLA-mu tetap aktif di browser ini.',
  },
};

export type WatchWords = typeof id;

const en: WatchWords = {
  title: 'Watch for new tasks',
  body: 'Sulo checks SIKOLA every 15 minutes while your computer is in use, and each time you open Sulo, then tells you when there is a new task, deadline or update.',
  session: 'While this is on, your SIKOLA session stays active in this browser.',
  closed: 'While the browser is closed, Sulo cannot check. It catches up as soon as the browser opens again.',
  stopped: "Watching is paused by Sulo's maintainer.",
  whatsNew: {
    title: 'SIKOLA news arrives faster',
    body: 'Turn on Watch for new tasks so Sulo checks SIKOLA every 15 minutes and each time you open Sulo. While it is on, your SIKOLA session stays active in this browser.',
  },
};

export function watchWords(locale: Locale): WatchWords {
  return locale === 'en' ? en : id;
}
