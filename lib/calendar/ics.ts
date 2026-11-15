// ICS output for the public subscription feeds (docs/KALENDER-AKADEMIK.md,
// "Aturan ICS"). Pure. Only public academic dates; never personal data.
// - UID `{id}@sulo`, stable across revisions; SEQUENCE = revisi and
//   LAST-MODIFIED = diperbarui, so a re-import updates instead of duplicating
// - all-day events, exclusive DTEND (the data keeps inclusive ends)
// - CATEGORIES, URL and DESCRIPTION name the source and the decree number
// - no VALARM: the calendar app decides about reminders

import { addDays, toBasic } from './dates.ts';
import type { CalendarFile, Kategori, Kegiatan, Libur } from './schema.ts';

export const ICS_PRODID = '-//Sulo//Kalender Akademik Unhas (tidak resmi)//ID';

/** RFC 5545 TEXT escaping. */
export function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Folds a content line at 75 octets (UTF-8), never inside a character. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (size + bytes > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export interface FeedEvent {
  id: string;
  judul: string;
  mulai: string;
  /** Inclusive; null for an open-ended event (shown as its first day). */
  selesai: string | null;
  kategori: string;
  keterangan: string[];
  /** The academic year's file this event comes from (source, revision). */
  source?: CalendarFile;
}

export interface FeedOptions {
  name: string;
  description: string;
}

const stamp = (key: string) => `${toBasic(key)}T000000Z`;

export function eventLines(e: FeedEvent, fallback: CalendarFile): string[] {
  const file = e.source ?? fallback;
  const end = addDays(e.selesai ?? e.mulai, 1);
  const description = [
    ...e.keterangan,
    `Sumber: ${file.sumber.sk}, ${file.sumber.judul}. Revisi data ${file.revisi}, diperbarui ${file.diperbarui}.`,
    'Tidak resmi dan tidak berafiliasi dengan Universitas Hasanuddin. Rujuk dokumen resmi.',
  ].join('\n');
  return [
    'BEGIN:VEVENT',
    `UID:${e.id}@sulo`,
    `DTSTAMP:${stamp(file.diperbarui)}`,
    `LAST-MODIFIED:${stamp(file.diperbarui)}`,
    `SEQUENCE:${file.revisi}`,
    `DTSTART;VALUE=DATE:${toBasic(e.mulai)}`,
    `DTEND;VALUE=DATE:${toBasic(end)}`,
    `SUMMARY:${escapeText(e.judul)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `CATEGORIES:${escapeText(e.kategori)}`,
    `URL:${file.sumber.halaman_url}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ];
}

export function buildIcs(events: readonly FeedEvent[], file: CalendarFile, options: FeedOptions): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${ICS_PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(options.name)}`,
    `X-WR-CALDESC:${escapeText(options.description)}`,
    `X-WR-TIMEZONE:${file.zona_waktu}`,
    ...events.flatMap((e) => eventLines(e, file)),
    'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

function fromKegiatan(k: Kegiatan): FeedEvent {
  const keterangan = [
    k.perkiraan ? 'Perkiraan bulan; tanggal pastinya diumumkan kemudian.' : '',
    k.ujung_terbuka ? 'Tanggal akhir belum ada di kalender ini.' : '',
    k.catatan,
    ...k.rincian,
  ].filter((s, i, all) => s !== '' && all.indexOf(s) === i);
  return { id: k.id, judul: k.judul, mulai: k.mulai, selesai: k.selesai, kategori: k.kategori, keterangan };
}

function fromLibur(l: Libur): FeedEvent {
  return {
    id: l.id,
    judul: l.nama,
    mulai: l.mulai,
    selesai: l.selesai,
    kategori: l.jenis,
    keterangan: [l.catatan, l.status_verifikasi === 'cocok_skb' ? '' : 'Dari PDF kalender akademik; belum dicocokkan dengan SKB 3 Menteri.'].filter(Boolean),
  };
}

/** Categories in the S1 core feed: what an active undergraduate plans around. */
export const CORE_CATEGORIES: readonly Kategori[] = ['krs', 'perkuliahan', 'uts', 'uas', 'libur', 'nilai', 'sanggah', 'evaluasi', 'kkn', 'administrasi', 'lainnya'];

const forS1 = (k: Kegiatan) => k.jenjang.includes('semua') || k.jenjang.includes('S1');

export type FeedId = 'inti-s1' | 'wisuda' | 'libur-nasional';

export const FEEDS: Record<FeedId, FeedOptions & { file: string }> = {
  'inti-s1': {
    file: 'sulo-inti-s1.ics',
    name: 'Kalender akademik Unhas: inti S1 (Sulo, tidak resmi)',
    description: 'KRS, perkuliahan, UTS, UAS, libur semester, nilai, evaluasi, KKN, dan batas administrasi untuk mahasiswa S1. Disusun Sulo dari kalender akademik resmi. Tidak resmi; rujuk dokumen resmi.',
  },
  wisuda: {
    file: 'sulo-wisuda.ics',
    name: 'Wisuda Unhas (Sulo, tidak resmi)',
    description: 'Periode wisuda dari kalender akademik resmi. Tidak resmi; rujuk dokumen resmi.',
  },
  'libur-nasional': {
    file: 'sulo-libur-nasional.ics',
    name: 'Libur nasional di kalender akademik Unhas (Sulo, tidak resmi)',
    description: 'Hari libur nasional dan cuti bersama sebagaimana tercantum di PDF kalender akademik. Tidak resmi; rujuk dokumen resmi.',
  },
};

/** The events of one feed, from one or more academic years (newest data wins per id). */
export function feedEvents(feed: FeedId, files: readonly CalendarFile[]): { events: FeedEvent[]; file: CalendarFile } {
  const latest = [...files].sort((a, b) => a.tahun_ajaran.localeCompare(b.tahun_ajaran) || a.revisi - b.revisi).at(-1);
  if (!latest) throw new Error('no calendar file');
  const events = files.flatMap((f): FeedEvent[] => {
    const withSource = (e: FeedEvent): FeedEvent => ({ ...e, source: f });
    if (feed === 'libur-nasional') return f.libur_nasional.map(fromLibur).map(withSource);
    const kegiatan = f.kegiatan.filter((k) => k.audiens !== 'calon_mahasiswa');
    if (feed === 'wisuda') return kegiatan.filter((k) => k.kategori === 'wisuda').map(fromKegiatan).map(withSource);
    return kegiatan.filter((k) => CORE_CATEGORIES.includes(k.kategori) && forS1(k)).map(fromKegiatan).map(withSource);
  });
  return { events: events.sort((a, b) => a.mulai.localeCompare(b.mulai) || a.id.localeCompare(b.id)), file: latest };
}

export function buildFeed(feed: FeedId, files: readonly CalendarFile[]): string {
  const { events, file } = feedEvents(feed, files);
  return buildIcs(events, file, FEEDS[feed]);
}
