// Readers for the five Sipakamase fragments (sipakamase/allowlist.ts), pure
// and DOM-free so the extension's service worker, the phone and the passive
// page reader share them. Each one reads only what the MKPK card and its
// reminders need, and fails whole: a table whose headings differ from the
// ones below gives `shape` and nothing is stored (Sipakamase changed).
//
// Never read: the action buttons and their addresses, the companion's and
// verifier's names (only whether there is one), any grade (only whether
// there is one), personal data. Nothing here returns a link.

import { buildTree, childElements, elements, firstLine, hasClass, textOf, type HtmlElement } from '../html/tree';
import { mkpkCourse } from '../mkpk/codes';

export type ParseResult<T> = { ok: true; data: T } | { ok: false; reason: 'login' | 'shape' };

export type BasisCode = 'kompetisi' | 'kewirausahaan' | 'keorganisasian' | 'kepesertaan' | 'pengabdian' | 'magang' | 'minat' | 'publikasi' | 'kepesertaan_kompetisi' | 'unknown';
export type StatusCode = 'planned' | 'done' | 'finished' | 'unknown';

export interface Activity {
  semester: string;
  basis: BasisCode;
  kind: string;
  /** The student's own name for the activity (their data, kept on the device). */
  name: string;
  status: StatusCode;
  /** The status as the site wrote it, shown as it is when the code is unknown. */
  statusText: string;
  /** Null in the history table, which has no companion column. */
  hasCompanion: boolean | null;
  hasScore: boolean;
}

export interface PassedCourse {
  code: string | null;
  name: string;
  sks: number;
  /** "Nilai Di Neosia": true (Sudah), false (anything that says not yet), null when unknown. */
  inNeosia: boolean | null;
}

export interface Programmed {
  code: string;
  kind: 'reguler' | 'mkpk' | 'unknown';
}

export interface Conversion {
  /** The activity's name, to match it with the activity lists. */
  name: string;
  sksTotal: number;
  sksUnconverted: number;
}

export interface CollectedCourse {
  name: string;
  sks: number;
  /** Credits allocated so far. */
  collected: number;
}

const MAX_NAME = 160;
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const clip = (s: string) => (s.length > MAX_NAME ? `${s.slice(0, MAX_NAME - 1)}…` : s);
const empty = (s: string) => s === '' || s === '-' || s === '–';

/** "0.58", "0,58", "2" → number; null otherwise. */
export function readNumber(text: string): number | null {
  const t = text.trim().replace(',', '.');
  return /^\d+(?:\.\d+)?$/.test(t) ? Number(t) : null;
}

const BASIS: Record<string, BasisCode> = {
  kompetisi: 'kompetisi',
  kewirausahaan: 'kewirausahaan',
  keorganisasian: 'keorganisasian',
  kepesertaan: 'kepesertaan',
  'pengabdian masyarakat': 'pengabdian',
  'magang / studi independen': 'magang',
  'magang/studi independen': 'magang',
  'pengembangan minat dan bakat pendukung': 'minat',
  'pengembangan minat dan bakat': 'minat',
  'publikasi ilmiah': 'publikasi',
  'kepesertaan kompetisi': 'kepesertaan_kompetisi',
};
export const basisOf = (text: string): BasisCode => BASIS[norm(text)] ?? 'unknown';

const STATUS: Record<string, StatusCode> = { terencana: 'planned', terlaksana: 'done', selesai: 'finished' };
export const statusOf = (text: string): StatusCode => STATUS[norm(text)] ?? 'unknown';

/** A page that asks for a password is the login page: the session is gone. */
const isLoginPage = (root: HtmlElement) => elements(root, 'input').some((i) => (i.attrs.type ?? '').toLowerCase() === 'password');

/** The rows of the first table whose heading cells are exactly `headers` (case and spacing aside). */
function tableRows(root: HtmlElement, headers: readonly string[]): HtmlElement[][] | null {
  const want = headers.map(norm);
  for (const table of elements(root, 'table')) {
    const rows = elements(table, 'tr');
    const head = rows.findIndex((r) => childElements(r, 'th').length > 0);
    if (head < 0) continue;
    const got = childElements(rows[head]!, 'th').map((th) => norm(textOf(th)));
    if (got.length !== want.length || got.some((g, i) => g !== want[i])) continue;
    return rows.slice(head + 1).map((r) => childElements(r, 'td')).filter((cells) => cells.length > 0);
  }
  return null;
}

const shapeOrLogin = <T>(root: HtmlElement): ParseResult<T> => ({ ok: false, reason: isLoginPage(root) ? 'login' : 'shape' });

const RUNNING_HEADERS = ['Aksi', '#', 'Semester', 'Basis', 'Kegiatan', 'Nama Kegiatan', 'Pendamping Kegiatan', 'Nilai', 'Status'];
const HISTORY_HEADERS = ['Aksi', '#', 'Semester', 'Basis', 'Kegiatan', 'Nama Kegiatan', 'Nilai', 'Status'];

function activityRows(html: string, headers: readonly string[], companion: boolean): ParseResult<Activity[]> {
  const root = buildTree(html);
  const rows = tableRows(root, headers);
  if (rows === null) return shapeOrLogin(root);
  const out: Activity[] = [];
  for (const cells of rows) {
    if (cells.length !== headers.length) return { ok: false, reason: 'shape' };
    const at = (i: number) => cells[i]!;
    const statusText = firstLine(at(headers.length - 1));
    const name = clip(firstLine(at(5)));
    if (name === '') return { ok: false, reason: 'shape' };
    out.push({
      semester: textOf(at(2)),
      basis: basisOf(textOf(at(3))),
      kind: clip(textOf(at(4))),
      name,
      status: statusOf(statusText),
      statusText: clip(statusText),
      hasCompanion: companion ? !empty(textOf(at(6))) : null,
      hasScore: !empty(textOf(at(companion ? 7 : 6))),
    });
  }
  return { ok: true, data: out };
}

/** /caktifitasmahasiswa/content: the activities in progress. */
export const parseRunning = (html: string) => activityRows(html, RUNNING_HEADERS, true);
/** /caktifitas/content: the history. */
export const parseHistory = (html: string) => activityRows(html, HISTORY_HEADERS, false);

const PASSED_HEADERS = ['#', 'Kode', 'Nama MK', 'SKS', 'Nilai', 'Nilai Di Neosia'];
const PROGRAMMED_HEADERS = ['#', 'Kode', 'Nama MK', 'SKS', 'Jenis MK'];

const inNeosiaOf = (text: string): boolean | null => {
  const t = norm(text);
  if (t === 'sudah') return true;
  if (t === 'belum' || t === 'belum dikirim' || t === 'tidak' || t === '-') return false;
  return null;
};

/** /cklaim/content: passed MKPK/MBKM courses (without their grade) and the courses in the KRS. */
export function parseClaim(html: string): ParseResult<{ passed: PassedCourse[]; programmed: Programmed[] }> {
  const root = buildTree(html);
  const page = norm(textOf(root));
  const passedRows = tableRows(root, PASSED_HEADERS) ?? (page.includes('matakuliah mkpk/mbkm yang dilulusi') ? [] : null);
  const programmedRows = tableRows(root, PROGRAMMED_HEADERS) ?? (page.includes('matakuliah yang diprogramkan') ? [] : null);
  if (passedRows === null || programmedRows === null) return shapeOrLogin(root);
  const passed: PassedCourse[] = [];
  for (const cells of passedRows) {
    if (cells.length !== PASSED_HEADERS.length) return { ok: false, reason: 'shape' };
    const code = textOf(cells[1]!).toUpperCase() || null;
    const sks = readNumber(textOf(cells[3]!));
    if (sks === null) return { ok: false, reason: 'shape' };
    // Column 4 (the grade) is never read.
    passed.push({ code, name: clip(textOf(cells[2]!)), sks, inNeosia: inNeosiaOf(textOf(cells[5]!)) });
  }
  const programmed: Programmed[] = [];
  for (const cells of programmedRows) {
    if (cells.length !== PROGRAMMED_HEADERS.length) return { ok: false, reason: 'shape' };
    const kind = norm(textOf(cells[4]!));
    const code = textOf(cells[1]!).toUpperCase();
    if (code === '') return { ok: false, reason: 'shape' };
    programmed.push({ code, kind: kind === 'reguler' ? 'reguler' : kind === 'mkpk/mbkm' ? 'mkpk' : 'unknown' });
  }
  return { ok: true, data: { passed, programmed } };
}

/** "Manajemen Kegiatan (2)" → name and credits. */
const NAME_SKS = /^(.*?)\s*\((\d{1,2})\)\s*$/;

/** The items of the list whose first item reads `heading`; null when there is no such list. */
function listUnder(root: HtmlElement, heading: string): HtmlElement[] | null {
  for (const li of elements(root, 'li')) {
    if (norm(textOf(li)) !== norm(heading) || !li.parent) continue;
    return childElements(li.parent, 'li').filter((x) => x !== li);
  }
  return null;
}

/** /ckonversimhs/matakuliah: MKPK courses passed and not yet passed, with the credits collected (never the grade). */
export function parseCourses(html: string): ParseResult<{ passed: CollectedCourse[]; notPassed: CollectedCourse[] }> {
  const root = buildTree(html);
  const passedItems = listUnder(root, 'Daftar MK yang dilulusi.');
  if (passedItems === null) return shapeOrLogin(root);
  const read = (items: HtmlElement[]): CollectedCourse[] | null => {
    const out: CollectedCourse[] = [];
    for (const li of items) {
      // The name is the item's own text; the badges sit in a span after it.
      const own = li.children.filter((c) => typeof c === 'string').join(' ').replace(/\s+/g, ' ').trim();
      const m = NAME_SKS.exec(own);
      const badges = elements(li, 'span').filter((s) => hasClass(s, 'badge'));
      const collected = badges[0] ? readNumber(textOf(badges[0])) : null;
      if (!m || collected === null) return null;
      // The second badge is the grade: not read.
      out.push({ name: clip(m[1]!), sks: Number(m[2]), collected });
    }
    return out;
  };
  const passed = read(passedItems);
  const notPassed = read(listUnder(root, 'Daftar MK yang belum dilulusi.') ?? []);
  if (passed === null || notPassed === null) return { ok: false, reason: 'shape' };
  return { ok: true, data: { passed, notPassed } };
}

const UNCONVERTED = /SKS yang belum dikonversi\s*:?\s*([\d.,]+)\s*dari\s*([\d.,]+)/i;

/** /ckonversimhs/rekappoin: per activity, its credits and how many are not converted yet. */
export function parseConversions(html: string): ParseResult<Conversion[]> {
  const root = buildTree(html);
  const heading = norm(textOf(root)).includes('matakuliah mkpk yang direkognisi');
  const items = elements(root, 'li').filter((li) => {
    const smalls = childElements(li, 'small');
    return smalls.length > 0 && norm(textOf(smalls[0]!)) === 'kegiatan';
  });
  if (items.length === 0) return heading ? { ok: true, data: [] } : shapeOrLogin(root);
  const out: Conversion[] = [];
  for (const li of items) {
    const smalls = childElements(li, 'small');
    const name = smalls[1] ? clip(textOf(smalls[1])) : '';
    const h5 = childElements(li, 'h5')[0];
    const m = h5 ? UNCONVERTED.exec(textOf(h5)) : null;
    const unconverted = m ? readNumber(m[1]!) : null;
    const total = m ? readNumber(m[2]!) : null;
    if (name === '' || unconverted === null || total === null) return { ok: false, reason: 'shape' };
    out.push({ name, sksTotal: total, sksUnconverted: unconverted });
  }
  return { ok: true, data: out };
}

/** The MKPK course for a passed row: by code when it has one, else by name among the listed courses. */
export function passedMkpk(row: PassedCourse) {
  return mkpkCourse(row.code, row.name);
}
