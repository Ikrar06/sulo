// A course's grades for its tasks in one page (1.1.0, owner's decision 27 Nov 2026): the student's own grade
// report, /grade/report/user/index.php?id={courseid}, read only when the student taps "Lihat nilai" (one page
// for every assignment of that course instead of one page per task).
//
// Read: the report table (class user-grade), and in each of its rows only two cells, both found by their
// column classes, which do not depend on the interface language: the item name (the link to the assignment's
// page, which gives its cmid, and the link's words, the assignment's name) and the grade. An assignment Sulo
// never saw in SIKOLA's calendar (handed in before, nothing to submit online) is known from here. Never the
// feedback, the weight, the range, the percentage or the contribution columns, never a row that is not an
// assignment. Pure, text level.

import { SIKOLA_ORIGIN } from '../moodle/limits';
import { cellText, gradeFromCell, type AssignGrade } from './grade';

export const COURSE_REPORT_PATH = '/grade/report/user/index.php';

/** The student's own grade report of one course: nothing but the course id (never another user's). */
export const courseReportPath = (courseId: number): string => `${COURSE_REPORT_PATH}?id=${courseId}`;

/** True only for /grade/report/user/index.php?id={number}, with no other parameter (no userid, no sesskey). */
export function isReadOnlyCourseReportUrl(pathAndQuery: string): boolean {
  let url: URL;
  try {
    url = new URL(pathAndQuery, SIKOLA_ORIGIN);
  } catch {
    return false;
  }
  if (url.pathname !== COURSE_REPORT_PATH) return false;
  const keys = [...url.searchParams.keys()];
  const id = url.searchParams.get('id');
  return keys.length === 1 && keys[0] === 'id' && id !== null && /^\d{1,10}$/.test(id) && Number(id) > 0;
}

export interface ReportItem {
  /** The assignment's name, as the link reads (at most 200 characters). */
  name: string;
  grade: AssignGrade;
}

export type CourseReport = { kind: 'ok'; grades: Map<number, ReportItem> } | { kind: 'unknown' };

const ROW = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
const cell = (row: string, column: string): string | null =>
  new RegExp(`<(t[hd])\\b[^>]*class="[^"]*\\bcolumn-${column}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/\\1>`, 'i').exec(row)?.[2] ?? null;
const ASSIGN_LINK = /<a\b[^>]*href="[^"]*\/mod\/assign\/view\.php\?id=(\d{1,10})\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i;

/** Every assignment row of the report: its cmid, name and grade. A page without the report table is unknown. */
export function parseCourseReport(html: string): CourseReport {
  const start = html.search(/<table\b[^>]*class="[^"]*\buser-grade\b/i);
  if (start < 0) return { kind: 'unknown' };
  const end = html.indexOf('</table>', start);
  const table = html.slice(start, end < 0 ? undefined : end);
  if (!/\bcolumn-grade\b/.test(table)) return { kind: 'unknown' };
  const grades = new Map<number, ReportItem>();
  for (const row of table.matchAll(ROW)) {
    const name = cell(row[1]!, 'itemname');
    const link = name === null ? null : ASSIGN_LINK.exec(name.replace(/&amp;/g, '&'));
    if (!link) continue;
    const grade = cell(row[1]!, 'grade');
    grades.set(Number(link[1]), { name: cellText(link[2]!).slice(0, 200), grade: grade === null ? { kind: 'unknown' } : gradeFromCell(grade) });
  }
  return { kind: 'ok', grades };
}
