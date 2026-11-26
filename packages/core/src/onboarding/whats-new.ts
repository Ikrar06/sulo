// "Yang baru di Sulo". Someone who finished onboarding never repeats it. When a
// big feature arrives, the notice version is bumped and they see one short
// screen with the entries newer than the version they last read (stored under
// NOTICE_KEY). At most three entries per release, one sentence each and at
// most one action. The full list of changes stays in CHANGELOG.md.

import type { Locale } from '../i18n';

export interface WhatsNewEntry {
  /** The notice version that introduced this entry. */
  noticeVersion: number;
  id: string;
  title: { id: string; en: string };
  body: { id: string; en: string };
  /** One action in place: the "Pantau tugas baru" switch (extension), or "Hubungkan Sipakamase". */
  action?: 'watch' | 'sipakamase';
  /** Where it shows; both when absent. */
  platforms?: readonly ('extension' | 'android')[];
}

/** 1.1.0 (notice version 2). Ordered as they show: the biggest change first. */
export const WHATS_NEW: readonly WhatsNewEntry[] = [
  {
    noticeVersion: 2,
    id: 'sipakamase',
    title: { id: 'Sulo terhubung ke Sipakamase', en: 'Sulo connects to Sipakamase' },
    body: {
      id: 'Lihat kegiatan MKPK yang belum dikonversi, nilai yang belum masuk NEOSIA, dan dapat pengingat sebelum batas nilai. Sulo hanya membaca, dan kamu masuk di halaman Sipakamase sendiri.',
      en: 'See MKPK activities not yet converted, grades not yet in NEOSIA, and get reminders before the grade deadline. Sulo only reads, and you sign in on Sipakamase’s own page.',
    },
    action: 'sipakamase',
  },
  {
    noticeVersion: 2,
    id: 'mkpk-card',
    title: { id: 'Progres MKPK di dashboard', en: 'MKPK progress on the dashboard' },
    body: {
      id: 'Kalau NEOSIA sudah terhubung, kartu MKPK menghitung SKS MKPK di transkrip dan KRS-mu, dan menunjukkan MKPK yang ditawarkan prodimu semester ini.',
      en: 'With NEOSIA connected, the MKPK card adds up the MKPK credits on your transcript and KRS, and shows the MKPK courses your program offers this semester.',
    },
  },
  {
    noticeVersion: 2,
    id: 'watch',
    title: { id: 'Kabar SIKOLA lebih cepat', en: 'SIKOLA news arrives faster' },
    body: {
      id: 'Nyalakan Pantau tugas baru supaya Sulo mengecek SIKOLA tiap 15 menit dan tiap kali kamu membuka Sulo.',
      en: 'Turn on Watch for new tasks so Sulo checks SIKOLA every 15 minutes and each time you open Sulo.',
    },
    action: 'watch',
    // The phone already had it; its 1.1.0 change (a light check on opening) needs no entry.
    platforms: ['extension'],
  },
];

export function pendingWhatsNew(entries: readonly WhatsNewEntry[], readVersion: number, completed: boolean, platform: 'extension' | 'android' = 'extension'): WhatsNewEntry[] {
  if (!completed) return [];
  return entries.filter((e) => e.noticeVersion > readVersion && (e.platforms === undefined || e.platforms.includes(platform)));
}

/** An entry's words in the page's language. */
export const entryText = (entry: WhatsNewEntry, locale: Locale) => ({ title: entry.title[locale], body: entry.body[locale] });
