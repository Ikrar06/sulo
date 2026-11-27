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
  platforms?: readonly WhatsNewPlatform[];
}

/** The surfaces Sulo runs on: the iPhone joins in 1.1.0 (B3). */
export type WhatsNewPlatform = 'extension' | 'android' | 'ios';

/**
 * 1.1.0 (notice version 2). Ordered as they show: the biggest change first, at most three per platform. Task
 * grades and own tasks reach everyone; the MKPK card needs no entry (it shows itself to NEOSIA users), and
 * Sipakamase has Ringkasan's own invite on the extension, where the third place goes to the watch switch.
 */
export const WHATS_NEW: readonly WhatsNewEntry[] = [
  {
    noticeVersion: 2,
    id: 'nilai-tugas',
    title: { id: 'Nilai tugas dari SIKOLA', en: 'Task grades from SIKOLA' },
    body: {
      id: 'Tugas yang sudah dinilai ditandai selesai sendiri, dan angkanya tersembunyi sampai kamu memilih Tampilkan nilai.',
      en: 'Graded tasks are marked as done on their own, and the numbers stay hidden until you choose Show grades.',
    },
  },
  {
    noticeVersion: 2,
    id: 'tugas-sendiri',
    title: { id: 'Tambah tugas sendiri', en: 'Add your own tasks' },
    body: {
      id: 'Tugas dari dosen yang tidak ada di SIKOLA, misalnya presentasi, bisa kamu catat, dan Sulo ikut mengingatkan tenggatnya.',
      en: 'Note down work your lecturer gave outside SIKOLA, such as a presentation, and Sulo reminds you of it too.',
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
  {
    noticeVersion: 2,
    id: 'sipakamase',
    title: { id: 'Sulo terhubung ke Sipakamase', en: 'Sulo connects to Sipakamase' },
    body: {
      id: 'Kegiatan MKPK yang belum dikonversi, nilai yang belum masuk NEOSIA, dan pengingat sebelum batas nilai. Sulo hanya membaca.',
      en: 'MKPK activities not yet converted, grades not yet in NEOSIA, and reminders before the grade deadline. Sulo only reads.',
    },
    action: 'sipakamase',
    platforms: ['android', 'ios'],
  },
];

export function pendingWhatsNew(entries: readonly WhatsNewEntry[], readVersion: number, completed: boolean, platform: WhatsNewPlatform = 'extension'): WhatsNewEntry[] {
  if (!completed) return [];
  return entries.filter((e) => e.noticeVersion > readVersion && (e.platforms === undefined || e.platforms.includes(platform)));
}

/** An entry's words in the page's language. */
export const entryText = (entry: WhatsNewEntry, locale: Locale) => ({ title: entry.title[locale], body: entry.body[locale] });
