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

export function readTranscript(data: Projected | null | undefined): TranscriptRow[] {
  const rows = obj(data ?? null)?.transkrip;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => obj(r))
    .filter((r): r is Obj => r !== null)
    .map((r) => {
      const code = str(r.kode_mata_kuliah);
      const name = str(r.nama_mata_kuliah) ?? code ?? '';
      const semester = str(r.id_semester);
      return {
        key: `${code ?? name}|${semester ?? ''}`,
        code,
        name,
        sks: typeof r.sks === 'number' && r.sks >= 0 ? r.sks : Number(str(r.sks) ?? 0) || 0,
        letter: str(r.nilai_huruf),
        semester,
        used: r.is_used !== false,
        transfer: r.is_alih_kredit === true,
        manual: r.is_manual === true,
      };
    })
    .filter((r) => r.name !== '');
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

/** Rows by semester, newest first. */
export function bySemester(rows: readonly TranscriptRow[]): SemesterGroup[] {
  const map = new Map<string, TranscriptRow[]>();
  for (const r of rows) map.set(r.semester ?? '-', [...(map.get(r.semester ?? '-') ?? []), r]);
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a, 'en', { numeric: true }))
    .map(([semester, list]) => ({ semester, rows: list, ips: gpaOf(list), sks: list.reduce((n, r) => n + r.sks, 0) }));
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
