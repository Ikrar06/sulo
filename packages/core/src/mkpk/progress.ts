// The MKPK card's numbers, from data Sulo already has: the transcript
// summary (mkpk/transcript.ts), the KRS and the classes on offer (NEOSIA
// snapshots, which carry no grades). Pure.

import type { Projected } from '../neosia/project';
import type { Snapshots } from '../neosia/store';
import { dataOf } from '../neosia/view';
import { isK23Code, mkpkCourse } from './codes';
import type { MkpkTranscript } from './transcript';

export interface MkpkLine {
  code: string;
  name: string;
  sks: number;
}

export interface MkpkProgress {
  /** The student's curriculum has MKPK (Kurikulum 2023 codes, or MKPK courses, were seen). */
  applies: boolean;
  /** Passed MKPK courses on the transcript. */
  passed: MkpkLine[];
  passedSks: number;
  /** MKPK courses in this semester's KRS that are not passed yet. */
  enrolled: MkpkLine[];
  enrolledSks: number;
  /** MKPK courses the study program offers this semester, not passed and not enrolled. */
  offered: MkpkLine[];
  /** When each source was last read; null when it was never seen. */
  transcriptAt: number | null;
  krsAt: number | null;
}

type Obj = { [key: string]: Projected };
const obj = (v: Projected | undefined): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);
const list = (v: Projected | undefined): Projected[] => (Array.isArray(v) ? v : []);
const str = (v: Projected | undefined): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : typeof v === 'number' ? String(v) : null);
const num = (v: Projected | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
const cancelled = (v: Projected | undefined) => v === true || v === 1 || v === '1' || v === 'true';

/** One class (KRS or on offer) as an MKPK line, or null when it is not MKPK. */
function lineOf(kelas: Obj): MkpkLine | null {
  const mk = obj(kelas.mata_kuliah);
  const course = mkpkCourse(str(mk?.kode), str(mk?.nama_resmi) ?? str(mk?.nama_singkat));
  if (!course) return null;
  return { code: course.code, name: course.name, sks: num(kelas.sks) ?? course.sks };
}

const sum = (lines: readonly MkpkLine[]) => lines.reduce((n, l) => n + l.sks, 0);
const byCode = (a: MkpkLine, b: MkpkLine) => a.name.localeCompare(b.name, 'id') || a.sks - b.sks || a.code.localeCompare(b.code);

/** Credits as text: whole numbers as they are, fractions with the locale's separator (1,5 in Indonesian). */
export function sksText(sks: number, locale: 'id' | 'en'): string {
  const rounded = Math.round(sks * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : locale === 'id' ? String(rounded).replace('.', ',') : String(rounded);
}

export function mkpkProgress(snapshots: Snapshots, transcript: MkpkTranscript | null): MkpkProgress {
  const passed = (transcript?.passed ?? []).map((p) => ({ ...p }));
  const passedCodes = new Set(passed.map((p) => p.code));

  // This semester's KRS: classes that were not cancelled.
  const krs = obj(obj(dataOf(snapshots, 'belanja_krs') as Projected)?.kartu_rencana_studi);
  const krsClasses = list(krs?.kelas_kuliahs).map(obj).filter((k): k is Obj => k !== null && !cancelled(k.is_batal));
  let k23 = transcript?.k23 ?? false;
  const enrolled = new Map<string, MkpkLine>();
  for (const kelas of krsClasses) {
    if (isK23Code(str(obj(kelas.mata_kuliah)?.kode))) k23 = true;
    const line = lineOf(kelas);
    if (line && !passedCodes.has(line.code)) enrolled.set(line.code, line);
  }

  // Classes on offer, by curriculum semester; one line per course, however many classes it has.
  const offeredData = obj(dataOf(snapshots, 'kelas_kuliah_tersedia') as Projected);
  const offered = new Map<string, MkpkLine>();
  for (const group of Object.values(obj(offeredData?.semesters) ?? {})) {
    for (const item of list(group)) {
      const kelas = obj(item);
      if (!kelas || cancelled(kelas.is_batal)) continue;
      const line = lineOf(kelas);
      if (line && !passedCodes.has(line.code) && !enrolled.has(line.code) && !offered.has(line.code)) offered.set(line.code, line);
    }
  }

  const enrolledLines = [...enrolled.values()].sort(byCode);
  return {
    applies: k23 || passed.length > 0 || enrolled.size > 0,
    passed: passed.sort(byCode),
    passedSks: sum(passed),
    enrolled: enrolledLines,
    enrolledSks: sum(enrolledLines),
    offered: [...offered.values()].sort(byCode),
    transcriptAt: transcript?.at ?? null,
    krsAt: snapshots.belanja_krs?.seenAt ?? null,
  };
}
