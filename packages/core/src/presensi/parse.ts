// Parsers for SIKOLA's attendance pages (mod_attendance, student view).
// Pure, text-level (no DOM, so they run in the extension's service worker,
// on Android and in Vitest). Columns are found by their CSS classes, which
// do not depend on the interface language; status words are read in
// English and Indonesian, anything else is "unknown". A page whose shape is
// not recognized gives "unknown_shape", never an error.

import { zonedToUnix } from '../reminders/zoned';
import type { AttendanceStatus, ParseResult, Points, RecapRow, SessionRow } from './types';

const ROW = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
const CELL = /<td\b([^>]*)>([\s\S]*?)<\/td>/gi;

const decode = (s: string) =>
  s
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)));
const text = (html: string) => decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' ')).replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
const classOf = (attrs: string) => /class="([^"]*)"/i.exec(attrs)?.[1] ?? '';

export function parsePoints(raw: string): Points | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*$/.exec(raw);
  if (!m) return null;
  return { got: Number(m[1]!.replace(',', '.')), max: Number(m[2]!.replace(',', '.')) };
}

export function parsePercent(raw: string): number | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*%\s*$/.exec(raw);
  return m ? Number(m[1]!.replace(',', '.')) : null;
}

/** "All courses" (mode=1): one row per course with an attendance activity. */
export function parseRecap(html: string): ParseResult<RecapRow[]> {
  if (!/class="[^"]*\bcolsessionscompleted\b/.test(html) || !/class="[^"]*\bcolcourse\b/.test(html)) return { kind: 'unknown_shape' };
  const rows: RecapRow[] = [];
  for (const [, row] of html.matchAll(ROW)) {
    const cells = new Map<string, string>();
    for (const [, attrs, inner] of row!.matchAll(CELL)) {
      const cls = classOf(attrs!);
      if (/\baverageattendance\b/.test(cls)) cells.set('average', inner!);
      for (const key of ['colcourse', 'colatt', 'colsessionscompleted', 'colpointssessionscompleted', 'colpercentagesessionscompleted']) {
        if (new RegExp(`\\b${key}\\b`).test(cls) && !cells.has(key)) cells.set(key, inner!);
      }
    }
    if (cells.has('average') || !cells.has('colcourse')) continue;
    const courseId = /course\/view\.php\?id=(\d+)/.exec(cells.get('colcourse')!)?.[1];
    const cmid = /mod\/attendance\/view\.php\?(?:[^"]*?[&;?])?id=(\d+)/.exec(cells.get('colatt') ?? '')?.[1];
    const taken = /^\d+$/.exec(text(cells.get('colsessionscompleted') ?? ''))?.[0];
    if (!courseId || !cmid || taken === undefined) return { kind: 'unknown_shape' };
    rows.push({
      courseId: Number(courseId),
      cmid: Number(cmid),
      taken: Number(taken),
      points: parsePoints(text(cells.get('colpointssessionscompleted') ?? '')),
      percent: parsePercent(text(cells.get('colpercentagesessionscompleted') ?? '')),
    });
  }
  return { kind: 'ok', value: rows };
}

const STATUS_WORDS: [AttendanceStatus, RegExp][] = [
  ['present', /^(present|hadir)$/i],
  ['late', /^(late|terlambat|telat)$/i],
  ['excused', /^(excused|izin|ijin|sakit|dispensasi)$/i],
  ['absent', /^(absent|absen|alpa|alpha|tidak hadir|mangkir)$/i],
];

export function statusOf(raw: string): AttendanceStatus {
  const t = raw.trim();
  return STATUS_WORDS.find(([, re]) => re.test(t))?.[0] ?? 'unknown';
}

const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, mar: 3, maret: 3, march: 3, apr: 4, april: 4,
  may: 5, mei: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, aug: 8, agu: 8, agt: 8, agustus: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, okt: 10, oktober: 10, october: 10, nov: 11, november: 11, dec: 12, des: 12, desember: 12, december: 12,
};

/** "Wed 8.10.25", "08.10.2025", "8 Oct 2025", "Rab, 8 Okt 2025" -> "2025-10-08". */
export function dateKeyOf(raw: string): string | null {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));
  let m = /(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/.exec(raw);
  if (m) return `${year(m[3]!)}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  m = /(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{2,4})/.exec(raw);
  const month = m ? MONTHS[m[2]!.toLowerCase()] : undefined;
  return m && month ? `${year(m[3]!)}-${pad(month)}-${pad(Number(m[1]))}` : null;
}

/** "7:30AM - 10AM", "07.30 - 10.00" -> minutes after midnight of the start. */
export function startMinuteOf(raw: string): number | null {
  const m = /(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/i.exec(raw);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ampm = m[3]?.toLowerCase();
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/**
 * The date cell: "Wed 8.10.25<br>7:30AM - 10AM" (two lines) or, as SIKOLA
 * writes it, "Thu 20 Aug 2026 7:50AM - 10:20AM" (one line): split at the
 * first time.
 */
export function splitDateTime(cell: string): [string, string] {
  const [first = '', second = ''] = cell.split('\n');
  if (second) return [first.trim(), second.trim()];
  const m = /\s(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?\s*[-–]\s*\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)\s*$/i.exec(first);
  return m ? [first.slice(0, m.index).trim(), m[1]!.trim()] : [first.trim(), ''];
}

/** One course's sessions (view=5, "All"). */
export function parseDetail(html: string, timeZone: string): ParseResult<SessionRow[]> {
  const table = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map((m) => m[1]!).find((t) => /\bdatecol\b/.test(t) && /\bstatuscol\b/.test(t));
  if (!table) return { kind: 'unknown_shape' };
  const headers = [...table.matchAll(/<th\b([^>]*)>/gi)].map((m) => classOf(m[1]!));
  const col = (name: string) => headers.findIndex((c) => new RegExp(`\\b${name}\\b`).test(c));
  const at = { date: col('datecol'), desc: col('desccol'), status: col('statuscol'), points: col('pointscol'), remarks: col('remarkscol') };
  if (at.date < 0 || at.status < 0) return { kind: 'unknown_shape' };
  const body = /<tbody\b([^>]*)>([\s\S]*?)<\/tbody>/i.exec(table);
  if (!body || /class="[^"]*\bempty\b/.test(body[1]!)) return { kind: 'ok', value: [] };
  const sessions: SessionRow[] = [];
  for (const [, row] of body[2]!.matchAll(ROW)) {
    const cells = [...row!.matchAll(CELL)].map((m) => m[2]!);
    if (cells.length < headers.length) continue;
    const [dateText, timeText] = splitDateTime(text(cells[at.date]!));
    const day = dateKeyOf(dateText);
    const minute = startMinuteOf(timeText);
    const statusText = text(cells[at.status]!);
    sessions.push({
      dateText,
      timeText,
      at: day !== null && minute !== null ? zonedToUnix(day, minute, timeZone) : null,
      description: at.desc >= 0 ? text(cells[at.desc]!) : '',
      status: statusOf(statusText),
      statusText,
      points: at.points >= 0 ? parsePoints(text(cells[at.points]!)) : null,
      remarks: at.remarks >= 0 ? text(cells[at.remarks]!) : '',
    });
  }
  return { kind: 'ok', value: sessions };
}
