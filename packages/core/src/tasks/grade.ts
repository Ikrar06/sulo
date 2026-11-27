// A task's grade from its assignment page (1.1.0, "Lihat nilai"). mod_assign_get_assignments is not open to
// Sulo (servicenotavailable, docs/API-MOODLE.md), so the grade comes from the student's own view of the
// assignment, /mod/assign/view.php?id={cmid}: one GET, only when the student taps "Lihat nilai".
//
// Read: the grading status cell (its class, submissiongraded or submissionnotgraded, does not depend on the
// interface language) and, in the feedback table, the one row whose label is "Grade" or "Nilai". That label is
// interface text, so both languages are listed and tested and any other language gives "unknown". Nothing else
// on the page is read: never the grader's name, the feedback comments, files or the submission. Pure, text
// level (no DOM), so it runs in the service worker, on the phone and in Vitest.

import { SIKOLA_ORIGIN } from '../moodle/limits';

export const ASSIGN_PATH = '/mod/assign/view.php';

/** The student's view of one assignment: nothing but its id. */
export const assignViewPath = (cmid: number): string => `${ASSIGN_PATH}?id=${cmid}`;

/**
 * True only for mod/assign/view.php?id={number}, with no other parameter: no action (a submission form,
 * a confirmation), no sesskey, nothing that could change anything.
 */
export function isReadOnlyAssignUrl(pathAndQuery: string): boolean {
  let url: URL;
  try {
    url = new URL(pathAndQuery, SIKOLA_ORIGIN);
  } catch {
    return false;
  }
  if (url.pathname !== ASSIGN_PATH) return false;
  const keys = [...url.searchParams.keys()];
  const id = url.searchParams.get('id');
  return keys.length === 1 && keys[0] === 'id' && id !== null && /^\d{1,10}$/.test(id) && Number(id) > 0;
}

export type AssignGrade =
  /**
   * The grade as the page shows it; got (and max, and the letter) when it is a number: "85,00 / 100,00",
   * "90.00 (A)" (SIKOLA, 27 Nov 2026) or "85.00 / 100.00 (A)". A scale word stays text only.
   */
  | { kind: 'graded'; text: string; got: number | null; max: number | null; letter: string | null }
  | { kind: 'not_graded' }
  /** Graded, but the page shows no grade (hidden from students, or not released yet). */
  | { kind: 'not_shown' }
  /** A page Sulo does not recognize, or another interface language: open SIKOLA instead. */
  | { kind: 'unknown' };

/** The grade row's label in the interface languages Sulo knows (Moodle's gradenoun, and grade before 4.1). */
const GRADE_LABELS = new Set(['grade', 'nilai']);
const MAX_GRADE_TEXT = 60;

const ROW = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
const CELL = /<(t[hd])\b[^>]*>([\s\S]*?)<\/\1>/gi;

const decode = (s: string) =>
  s
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'");
const text = (html: string) => decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

/** "85,00" or "85.00" as a number; null for anything with both separators (a thousands mark would be a guess). */
function number(raw: string): number | null {
  if (raw.includes(',') && raw.includes('.')) return null;
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const NONE = { got: null, max: null, letter: null };

/** "85.00 / 100.00", "90.00 (A)", "85.00 / 100.00 (B+)": the numbers and the letter; nulls for anything else. */
function points(value: string): { got: number | null; max: number | null; letter: string | null } {
  const m = /^(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+(?:[.,]\d+)?))?(?:\s*\(([A-Za-z]{1,2}[+-]?)\))?$/.exec(value);
  if (!m) return NONE;
  const got = number(m[1]!);
  const max = m[2] === undefined ? null : number(m[2]);
  if (got === null || (m[2] !== undefined && max === null)) return NONE;
  return { got, max, letter: m[3] ?? null };
}

/** The feedback table's rows as [label, value cell html]; null when the page has no feedback box. */
function feedbackRows(html: string): [string, string][] | null {
  const start = html.search(/class="[^"]*\bfeedbacktable\b/);
  if (start < 0) return null;
  const end = html.indexOf('</table>', start);
  if (end < 0) return null;
  const rows: [string, string][] = [];
  for (const row of html.slice(start, end).matchAll(ROW)) {
    const cells = [...row[1]!.matchAll(CELL)];
    if (cells.length >= 2) rows.push([text(cells[0]![2]!), cells[1]![2]!]);
  }
  return rows;
}

export function parseAssignGrade(html: string): AssignGrade {
  const status = /<td\b[^>]*class="[^"]*\bsubmission(not)?graded\b/i.exec(html);
  const rows = feedbackRows(html);
  if (rows && rows.length > 0) {
    const row = rows.find(([label]) => GRADE_LABELS.has(label.replace(/:$/, '').trim().toLowerCase()));
    if (!row) {
      // Feedback without a grade on an ungraded task (a comment only): the status says so in any language.
      if (status?.[1]) return { kind: 'not_graded' };
      // Otherwise the box may be in a language Sulo cannot read: never guess which row is the grade.
      return { kind: 'unknown' };
    }
    const cell = row[1];
    const value = text(cell);
    if (/<img\b/i.test(cell) || value.length > MAX_GRADE_TEXT) return { kind: 'unknown' };
    if (value === '' || value === '-') return { kind: 'not_shown' };
    return { kind: 'graded', text: value, ...points(value) };
  }
  if (status) return status[1] ? { kind: 'not_graded' } : { kind: 'not_shown' };
  return { kind: 'unknown' };
}
