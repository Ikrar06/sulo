// "Tanggal penting terdekat": the nearest event that still matters for an
// active student, ongoing or upcoming. Pure; dates are local YYYY-MM-DD.
// Month-level estimates ("perkiraan bulan") are left out of the countdown.

import { daysBetween } from './dates.ts';
import type { CalendarFile, Jenjang, Kategori, Kegiatan } from './schema.ts';

export const IMPORTANT_CATEGORIES: readonly Kategori[] = ['krs', 'uts', 'uas', 'perkuliahan', 'libur', 'nilai', 'sanggah', 'administrasi', 'evaluasi'];

export interface UpcomingOptions {
  jenjang?: Jenjang;
  kategori?: readonly Kategori[];
}

export interface UpcomingItem {
  kegiatan: Kegiatan;
  status: 'berlangsung' | 'akan_datang';
  /** Days until it starts (0 while ongoing). */
  hariLagi: number;
}

const forLevel = (k: Kegiatan, jenjang: Jenjang) => k.jenjang.includes('semua') || k.jenjang.includes(jenjang);

/** Every relevant event that has not ended, nearest first (ongoing before upcoming). */
export function upcomingList(file: CalendarFile, today: string, options: UpcomingOptions = {}): UpcomingItem[] {
  const jenjang = options.jenjang ?? 'S1';
  const kategori = options.kategori ?? IMPORTANT_CATEGORIES;
  return file.kegiatan
    .filter((k) => k.audiens !== 'calon_mahasiswa' && !k.perkiraan && kategori.includes(k.kategori) && forLevel(k, jenjang))
    .filter((k) => k.selesai === null || k.selesai >= today)
    .map((k): UpcomingItem => (k.mulai <= today ? { kegiatan: k, status: 'berlangsung', hariLagi: 0 } : { kegiatan: k, status: 'akan_datang', hariLagi: daysBetween(today, k.mulai) }))
    .sort((a, b) => a.hariLagi - b.hariLagi || (a.kegiatan.selesai ?? '9999').localeCompare(b.kegiatan.selesai ?? '9999') || a.kegiatan.id.localeCompare(b.kegiatan.id));
}

export function nextImportant(file: CalendarFile, today: string, options: UpcomingOptions = {}): UpcomingItem | null {
  return upcomingList(file, today, options)[0] ?? null;
}
