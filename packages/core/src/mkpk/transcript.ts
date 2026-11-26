// What the MKPK card needs from the NEOSIA transcript, kept apart from it:
// the MKPK courses that were passed (code and credits) and how often each
// faculty letter appears in the course codes. No letter grade, no course
// name, nothing else. The Android app only decrypts the transcript itself
// for the screens that show grades (apps/mobile/src/neosia/grade-guard.ts),
// so the card reads this summary instead. Pure apart from the injected store.
//
// Written when a transcript capture is stored (neosia/store.ts), and once
// from an existing transcript for data captured before this summary existed.
// The key sits under NEOSIA_DATA_PREFIX, so turning NEOSIA off deletes it.

import type { KeyValueStore, UnixSeconds } from '../types';
import { NEOSIA_DATA_PREFIX } from '../neosia/module';
import type { Projected } from '../neosia/project';
import { facultyLetter, isK23Code, mkpkCourse } from './codes';

export const MKPK_TRANSCRIPT_KEY = `${NEOSIA_DATA_PREFIX}mkpk:transcript`;
export const MKPK_TRANSCRIPT_VERSION = 1;

export interface MkpkTranscript {
  v: typeof MKPK_TRANSCRIPT_VERSION;
  /** When the transcript it was read from arrived. */
  at: UnixSeconds;
  /** MKPK courses with a passing grade, one entry per code. */
  passed: { code: string; name: string; sks: number }[];
  /** Faculty letters of all course codes in the transcript, with how often each appears ("U" left out). */
  letters: Record<string, number>;
  /** The transcript has Kurikulum 2023 (or later) codes: the student has MKPK in their curriculum. */
  k23: boolean;
}

/**
 * Letters that do not pass a course: E (fail), T (pending: Peraturan Rektor
 * 29/UN4.1/2023, article 41) and K (withdrawn). Any other letter passes.
 */
const NOT_PASSED = new Set(['E', 'T', 'K']);

type Obj = { [key: string]: Projected };
const obj = (v: Projected | undefined): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);
const str = (v: Projected | undefined): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : typeof v === 'number' ? String(v) : null);
const num = (v: Projected | undefined): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^\d+(?:[.,]\d+)?$/.test(v.trim())) return Number(v.trim().replace(',', '.'));
  return null;
};

/** The summary of one projected transcript (getTranskripMahasiswa), or null when it has no transcript list. */
export function summarizeTranscript(data: Projected | null | undefined, at: UnixSeconds): MkpkTranscript | null {
  const rows = obj(data ?? null)?.transkrip;
  if (!Array.isArray(rows)) return null;
  const passed = new Map<string, { code: string; name: string; sks: number }>();
  const letters: Record<string, number> = {};
  let k23 = false;
  for (const item of rows) {
    const row = obj(item);
    if (!row) continue;
    const code = str(row.kode_mata_kuliah);
    if (isK23Code(code)) k23 = true;
    const letter = facultyLetter(code);
    if (letter && letter !== 'U') letters[letter] = (letters[letter] ?? 0) + 1;
    const course = mkpkCourse(code, str(row.nama_mata_kuliah));
    if (!course) continue;
    // A row NEOSIA marks as not used (an older attempt) does not count.
    if (row.is_used === false || row.is_used === 0 || row.is_used === '0') continue;
    const grade = str(row.nilai_huruf)?.toUpperCase() ?? null;
    if (grade === null || NOT_PASSED.has(grade)) continue;
    // The row's own credits when NEOSIA gives them; the code's otherwise.
    const sks = num(row.sks) ?? course.sks;
    passed.set(course.code, { code: course.code, name: course.name, sks });
  }
  return { v: MKPK_TRANSCRIPT_VERSION, at, passed: [...passed.values()].sort((a, b) => a.code.localeCompare(b.code)), letters, k23 };
}

/** Writes the summary of a transcript; removes a stale one when the transcript has no list. */
export async function writeMkpkTranscript(store: KeyValueStore, data: Projected | null | undefined, at: UnixSeconds): Promise<MkpkTranscript | null> {
  const summary = summarizeTranscript(data, at);
  if (summary) await store.set(MKPK_TRANSCRIPT_KEY, summary);
  return summary;
}

/**
 * The stored summary. When there is none yet but a transcript was captured
 * before this summary existed, it is made once from that transcript; the
 * transcript itself is not returned.
 */
export async function readMkpkTranscript(store: KeyValueStore, transcriptKey: string): Promise<MkpkTranscript | null> {
  const stored = await store.get<MkpkTranscript>(MKPK_TRANSCRIPT_KEY);
  if (stored && stored.v === MKPK_TRANSCRIPT_VERSION) return stored;
  const snapshot = await store.get<{ data?: Projected | null; seenAt?: UnixSeconds }>(transcriptKey);
  if (!snapshot?.data) return null;
  return writeMkpkTranscript(store, snapshot.data, snapshot.seenAt ?? 0);
}
