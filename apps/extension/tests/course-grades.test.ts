import { describe, expect, it } from 'vitest';
import { matchesStatus } from '@sulo/core/dashboard/tasks';
import { courseReportPath, isReadOnlyCourseReportUrl, parseCourseReport } from '@sulo/core/tasks/course-grades';
import { gradeBadge } from '@sulo/core/tasks/grade-view';

// Moodle 4.x's user report (gradereport_user): a category row, assignment rows, a quiz, the course total. The
// grade cell may carry screen-reader words; the feedback cell has a lecturer's comment that must never come out.
const page = `<div class="popover-region" data-userid="5"></div><div id="region-main">
<table class="generaltable boxaligncenter user-grade" summary="x"><thead><tr><th class="header column-itemname">Grade item</th><th class="header column-grade">Grade</th><th class="header column-feedback">Feedback</th></tr></thead><tbody>
<tr><th class="level1 column-itemname" colspan="7"><div>FISIKA DASAR</div></th></tr>
<tr><th class="level2 leveleven item column-itemname" scope="row"><div class="d-flex"><img class="icon itemicon" alt="Assignment"><a title="Link to Assignment activity" class="gradeitemheader" href="https://sikola-v2.unhas.ac.id/mod/assign/view.php?id=301">Sub CPMK 1</a></div></th><td class="level2 itemcenter column-weight">20,00 %</td><td class="level2 itemcenter column-grade"><span class="sr-only">Nilai: </span>90,00 (A)</td><td class="level2 column-range">0–100</td><td class="level2 column-feedback"><div class="no-overflow">Bagus, lanjutkan. Dosen X</div></td></tr>
<tr><th class="level2 column-itemname"><a class="gradeitemheader" href="/mod/assign/view.php?id=302&amp;action=x">Tugas 2</a></th><td class="level2 column-grade">-</td><td class="level2 column-feedback"></td></tr>
<tr><th class="level2 column-itemname"><a class="gradeitemheader" href="https://sikola-v2.unhas.ac.id/mod/quiz/view.php?id=305">Kuis 1</a></th><td class="level2 column-grade">8,00</td></tr>
<tr><th class="level1 column-itemname">Course total</th><td class="level1 column-grade">90,00</td></tr>
</tbody></table></div>`;

describe('a course\'s grade report', () => {
  it('reads each assignment\'s grade by its link, nothing from feedback, quizzes or totals', () => {
    const report = parseCourseReport(page);
    expect(report.kind).toBe('ok');
    if (report.kind !== 'ok') return;
    expect([...report.grades]).toEqual([
      [301, { name: 'Sub CPMK 1', grade: { kind: 'graded', text: '90,00 (A)', got: 90, max: null, letter: 'A' } }],
      [302, { name: 'Tugas 2', grade: { kind: 'not_graded' } }],
    ]);
    expect(JSON.stringify([...report.grades])).not.toMatch(/Bagus|Dosen|Nilai:/);
  });
  it('a page without the report table is unknown, never an empty answer', () => {
    expect(parseCourseReport('<div id="region-main"><p>Laporan nilai dinonaktifkan</p></div>')).toEqual({ kind: 'unknown' });
    expect(parseCourseReport('<table class="user-grade"><tr><td>x</td></tr></table>')).toEqual({ kind: 'unknown' });
  });
  it('is the student\'s own report, by course id only', () => {
    expect(courseReportPath(401)).toBe('/grade/report/user/index.php?id=401');
    expect(isReadOnlyCourseReportUrl(courseReportPath(401))).toBe(true);
    for (const path of ['/grade/report/user/index.php?id=401&userid=9', '/grade/report/user/index.php?userid=9', '/grade/report/user/index.php?id=401&sesskey=a', '/grade/report/grader/index.php?id=401', '/grade/report/user/index.php'])
      expect(isReadOnlyCourseReportUrl(path)).toBe(false);
  });
});

describe('grades in the lists', () => {
  const read = { kind: 'graded' as const, text: '90,00 (A)', got: 90, max: null, letter: 'A' };
  it('shows the number only with "Tampilkan nilai", a mask in privacy mode, nothing without a read grade', () => {
    expect(gradeBadge(null, { gradesShown: true, privacyMode: false }, 'id-ID')).toBeNull();
    expect(gradeBadge(read, { gradesShown: false, privacyMode: false }, 'id-ID')).toEqual({ kind: 'hidden' });
    expect(gradeBadge(read, { gradesShown: true, privacyMode: false }, 'id-ID')).toEqual({ kind: 'value', text: '90 (A)' });
    expect(gradeBadge(read, { gradesShown: true, privacyMode: true }, 'id-ID')).toEqual({ kind: 'masked' });
  });
  it('"Sudah dinilai" is any status Sulo knows was graded', () => {
    expect(matchesStatus({ status: 'pending', graded: true }, 'graded')).toBe(true);
    expect(matchesStatus({ status: 'done', graded: false }, 'graded')).toBe(false);
    expect(matchesStatus({ status: 'past', graded: false }, 'past')).toBe(true);
    expect(matchesStatus({ status: 'past', graded: false }, 'all')).toBe(true);
  });
});

describe('finished tasks', () => {
  it('are done, handed in, long past or graded: no countdown and nothing to add to a calendar', async () => {
    const { isFinishedItem } = await import('@sulo/core/dashboard/tasks');
    const graded = { kind: 'graded' as const, text: '90', got: 90, max: null, letter: null };
    expect(isFinishedItem({ status: 'pending', gradeRead: null })).toBe(false);
    expect(isFinishedItem({ status: 'inactive', gradeRead: null })).toBe(false);
    for (const status of ['done', 'submitted', 'past'] as const) expect(isFinishedItem({ status, gradeRead: null })).toBe(true);
    // Graded but unticked by the student: still finished.
    expect(isFinishedItem({ status: 'pending', gradeRead: graded })).toBe(true);
  });
});
