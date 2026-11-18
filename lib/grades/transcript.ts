// The Nilai page's numbers from the NEOSIA transcript (M7.1). Pure.
// - GPA (IPK): rows NEOSIA counts (is_used), credit transfers included,
//   letters on the scale only, weighted by credits.
// - Semester GPA (IPS): every row of the semester with a letter on the scale.
// - "Bisa diperbaiki": counted rows graded D or E (and C when asked). A
//   plain list, never a recommendation.
// - Simulation: the same count with some letters changed; nothing is stored.

import type { Projected } from '../neosia/project';
import { gradeWeight } from './scale';

export interface TranscriptRow {
  key: string;
  code: string | null;
  name: string;
  sks: number;
  letter: string | null;
  semester: string | null;
  used: boolean;
  transfer: boolean;
  manual: boolean;
}

type Obj = { [k: string]: Projected };
const obj = (v: Projected | undefined): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);
const str = (v: Projected | undefined) => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);
/** true/false, 1/0 and "1"/"0"/"true"/"false"; anything else is `fallback`. */
const flag = (v: Projected | undefined, fallback: boolean) => (v === true || v === 1 || v === '1' || v === 'true' ? true : v === false || v === 0 || v === '0' || v === 'false' ? false : fallback);
/** 3, "3", " 3 ", "2,5"; anything else is null. */
const toNumber = (v: Projected | undefined): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^\s*\d+(?:[.,]\d+)?\s*$/.test(v)) return Number(v.trim().replace(',', '.'));
  return null;
};

/**
 * Transcript rows, whatever the field types: id_semester as a number or a
 * string, is_used as a boolean or 0/1, credits as a number or a string,
 * letters with spaces or in lower case. A row without a name keeps its code.
 */
export function readTranscript(data: Projected | null | undefined): TranscriptRow[] {
  const rows = obj(data ?? null)?.transkrip;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => obj(r))
    .filter((r): r is Obj => r !== null)
    .map((r, i) => {
      const code = str(r.kode_mata_kuliah);
      const semester = str(r.id_semester);
      const letter = str(r.nilai_huruf)?.replace(/\s+/g, '').toUpperCase() ?? null;
      return {
        key: `${code ?? `row${i}`}|${semester ?? ''}`,
        code,
        name: str(r.nama_mata_kuliah) ?? code ?? '-',
        sks: Math.max(0, toNumber(r.sks) ?? 0),
        letter: letter === '' ? null : letter,
        semester,
        used: flag(r.is_used, true),
        transfer: flag(r.is_alih_kredit, false),
        manual: flag(r.is_manual, false),
      };
    });
}

// ---------- Semesters ----------

export interface SemesterInfo {
  id: string | null;
  kode: string | null;
  jenis: string | null;
  tahunAjaran: string | null;
}

/** /api/mahasiswa/semester: each semester's id (what transcript rows point to), code and name. */
export function readSemesters(data: Projected | null | undefined): SemesterInfo[] {
  const list = obj(data ?? null)?.semesters;
  if (!Array.isArray(list)) return [];
  return list
    .map((s) => obj(s))
    .filter((s): s is Obj => s !== null)
    .map((s) => ({ id: str(s.id), kode: str(s.kode), jenis: str(s.jenis), tahunAjaran: str(s.tahun_ajaran) }));
}

/** The semester a transcript id_semester points to: by its id, else by its code. */
export function findSemester(semesters: readonly SemesterInfo[], id: string | null): SemesterInfo | null {
  if (id === null) return null;
  return semesters.find((s) => s.id === id) ?? semesters.find((s) => s.kode === id) ?? null;
}

/** Ids in study order: numerically when all are numbers, else as text. */
export function semesterOrder(ids: readonly string[]): string[] {
  const unique = [...new Set(ids)];
  const numeric = unique.every((id) => /^\d+$/.test(id));
  return unique.sort((a, b) => (numeric ? Number(a) - Number(b) : a.localeCompare(b, 'en', { numeric: true })));
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Weighted mean of the rows with a letter on the scale; null without credits. */
export function gpaOf(rows: readonly Pick<TranscriptRow, 'sks' | 'letter'>[]): number | null {
  let points = 0;
  let credits = 0;
  for (const r of rows) {
    const w = gradeWeight(r.letter);
    if (w === null || r.sks <= 0) continue;
    points += w * r.sks;
    credits += r.sks;
  }
  return credits > 0 ? round2(points / credits) : null;
}

/** IPK: counted rows only (is_used), credit transfers included. */
export function computeIpk(rows: readonly TranscriptRow[]): number | null {
  return gpaOf(rows.filter((r) => r.used));
}

/** Credits of counted rows with a passing letter (above E). */
export function passedSks(rows: readonly TranscriptRow[]): number {
  return rows.filter((r) => r.used && (gradeWeight(r.letter) ?? 0) > 0).reduce((n, r) => n + r.sks, 0);
}

export interface SemesterGroup {
  semester: string;
  rows: TranscriptRow[];
  ips: number | null;
  sks: number;
}

/** Rows by semester (their id_semester as is), newest first; rows without one go last. */
export function bySemester(rows: readonly TranscriptRow[]): SemesterGroup[] {
  const map = new Map<string, TranscriptRow[]>();
  for (const r of rows) map.set(r.semester ?? '-', [...(map.get(r.semester ?? '-') ?? []), r]);
  const order = semesterOrder([...map.keys()].filter((k) => k !== '-')).reverse();
  return [...order, ...(map.has('-') ? ['-'] : [])].map((semester) => {
    const list = map.get(semester)!;
    return { semester, rows: list, ips: gpaOf(list), sks: list.reduce((n, r) => n + r.sks, 0) };
  });
}

/**
 * The label of a semester: its name from /api/mahasiswa/semester, else
 * "Semester {n}" by its place in the order of all ids (n = 1 for the first).
 */
export function semesterLabeler(rows: readonly TranscriptRow[], semesters: readonly SemesterInfo[]): (id: string) => { jenis: string | null; tahunAjaran: string | null; index: number } {
  const order = semesterOrder(rows.map((r) => r.semester).filter((s): s is string => s !== null));
  return (id) => {
    const found = findSemester(semesters, id);
    return { jenis: found?.jenis ?? null, tahunAjaran: found?.tahunAjaran ?? null, index: order.indexOf(id) + 1 };
  };
}

export interface TranscriptDiagnostics {
  stored: number;
  counted: number;
  mapped: number;
  /** Why rows do not count toward Sulo's GPA (a row can have several reasons). */
  notUsed: number;
  noLetter: number;
  noCredits: number;
  noSemester: number;
}

/** Development builds only: counts, never grades. */
export function transcriptDiagnostics(rows: readonly TranscriptRow[], semesters: readonly SemesterInfo[]): TranscriptDiagnostics {
  return {
    stored: rows.length,
    counted: rows.filter((r) => r.used && gradeWeight(r.letter) !== null && r.sks > 0).length,
    mapped: rows.filter((r) => findSemester(semesters, r.semester) !== null).length,
    notUsed: rows.filter((r) => !r.used).length,
    noLetter: rows.filter((r) => gradeWeight(r.letter) === null).length,
    noCredits: rows.filter((r) => r.sks <= 0).length,
    noSemester: rows.filter((r) => r.semester === null).length,
  };
}

/** Counted rows graded D or E, and C when `includeC`. Never a recommendation. */
export function improvable(rows: readonly TranscriptRow[], includeC = false): TranscriptRow[] {
  const letters = new Set(includeC ? ['C', 'D', 'E'] : ['D', 'E']);
  return rows.filter((r) => r.used && r.letter !== null && letters.has(r.letter.trim().toUpperCase()));
}

/** IPK with some letters changed (key → new letter). Nothing is stored. */
export function simulateIpk(rows: readonly TranscriptRow[], changes: Readonly<Record<string, string>>): number | null {
  return computeIpk(rows.map((r) => (r.key in changes ? { ...r, letter: changes[r.key]! } : r)));
}

/** Sulo's count against NEOSIA's official GPA: true when they differ by more than 0.01. */
export function differsFromNeosia(computed: number | null, official: number | null): boolean {
  return computed !== null && official !== null && Math.abs(computed - official) > 0.01;
}
