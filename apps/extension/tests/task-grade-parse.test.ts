import { describe, expect, it } from 'vitest';
import { assignViewPath, isReadOnlyAssignUrl, parseAssignGrade } from '@sulo/core/tasks/grade';

// Synthetic pages in Moodle 4.x's student view markup (mod_assign renderer): the submission status table,
// then the feedback box. Names and comments are made up and must never come out of the parser.
const WORDS = {
  en: { status: 'Grading status', graded: 'Graded', notGraded: 'Not graded', grade: 'Grade', on: 'Graded on', by: 'Graded by', comments: 'Feedback comments' },
  id: { status: 'Status penilaian', graded: 'Sudah dinilai', notGraded: 'Belum dinilai', grade: 'Nilai', on: 'Dinilai pada', by: 'Dinilai oleh', comments: 'Komentar umpan balik' },
} as const;

const row = (label: string, cell: string, tdClass = 'cell c1 lastcol') => `<tr class=""><th class="cell c0" style="" scope="row">${label}</th><td class="${tdClass}" style="">${cell}</td></tr>`;

function page(opts: { lang?: keyof typeof WORDS; graded: boolean; grade?: string | null; grader?: boolean; comment?: string; label?: string }): string {
  const w = WORDS[opts.lang ?? 'en'];
  const status = row(w.status, opts.graded ? w.graded : w.notGraded, `${opts.graded ? 'submissiongraded' : 'submissionnotgraded'} cell c1 lastcol`);
  const feedback: string[] = [];
  if (opts.grade != null) feedback.push(row(opts.label ?? w.grade, opts.grade), row(w.on, 'Thursday, 19 November 2026, 10:00 AM'));
  if (opts.grader) feedback.push(row(w.by, '<a href="https://sikola-v2.unhas.ac.id/user/view.php?id=9"><img src="x.png" class="userpicture" alt="" /></a> Dosen Contoh'));
  if (opts.comment) feedback.push(row(w.comments, `<div class="no-overflow"><p>${opts.comment}</p></div>`));
  return `<html><body><div class="popover-region" data-userid="5"></div><div role="main" id="region-main"><h2>Laporan praktikum</h2>
<div class="submissionstatustable"><h3>Submission status</h3><div class="box py-3 boxaligncenter submissionsummarytable"><table class="generaltable table-bordered"><tbody>
${row('Submission status', 'Submitted for grading', 'submissionstatussubmitted cell c1 lastcol')}${status}
</tbody></table></div></div>
${feedback.length ? `<div class="feedback"><h3 class="h4">Feedback</h3><div class="box py-3 boxaligncenter feedbacktable"><table class="generaltable"><tbody>${feedback.join('')}</tbody></table></div></div>` : ''}
</div></body></html>`;
}

describe('a task grade from the assignment page', () => {
  it.each(['en', 'id'] as const)('reads points in %s, never the grader or the comment', (lang) => {
    const html = page({ lang, graded: true, grade: lang === 'en' ? '85.00 / 100.00' : '85,00 / 100,00', grader: true, comment: 'Bagus sekali' });
    const grade = parseAssignGrade(html);
    expect(grade).toEqual({ kind: 'graded', text: lang === 'en' ? '85.00 / 100.00' : '85,00 / 100,00', got: 85, max: 100, letter: null });
    expect(JSON.stringify(grade)).not.toMatch(/Dosen|Bagus|user\/view/);
  });
  it('reads SIKOLA\'s number with its letter, "90.00 (A)", even when the status cell says not graded', () => {
    // As on a real SIKOLA page (27 Nov 2026): an assignment with nothing to submit online, graded through the
    // gradebook, so "Grading status" still reads "Not graded" while the feedback box has the grade.
    const html = page({ graded: false, grade: '90.00 (A)' });
    expect(parseAssignGrade(html)).toEqual({ kind: 'graded', text: '90.00 (A)', got: 90, max: null, letter: 'A' });
    expect(parseAssignGrade(page({ graded: true, grade: '85.00 / 100.00 (B+)' }))).toEqual({ kind: 'graded', text: '85.00 / 100.00 (B+)', got: 85, max: 100, letter: 'B+' });
  });
  it('keeps a scale or letter grade as the page writes it', () => {
    expect(parseAssignGrade(page({ lang: 'id', graded: true, grade: 'Sangat baik' }))).toEqual({ kind: 'graded', text: 'Sangat baik', got: null, max: null, letter: null });
    expect(parseAssignGrade(page({ graded: true, grade: 'A' }))).toMatchObject({ kind: 'graded', text: 'A' });
  });
  it('reads "not graded" from the status cell in any language', () => {
    expect(parseAssignGrade(page({ graded: false }))).toEqual({ kind: 'not_graded' });
    expect(parseAssignGrade(page({ lang: 'id', graded: false }))).toEqual({ kind: 'not_graded' });
    // A comment without a grade: still not graded.
    expect(parseAssignGrade(page({ graded: false, comment: 'Revisi bab 2', grader: true }))).toEqual({ kind: 'not_graded' });
  });
  it('says graded but not shown when the page has no grade for the student', () => {
    expect(parseAssignGrade(page({ graded: true }))).toEqual({ kind: 'not_shown' });
    expect(parseAssignGrade(page({ graded: true, grade: '-' }))).toEqual({ kind: 'not_shown' });
  });
  it('gives up on a language it cannot read, a picture in the cell, or another page', () => {
    expect(parseAssignGrade(page({ graded: true, grade: '85.00 / 100.00', label: 'Note' }))).toEqual({ kind: 'unknown' });
    expect(parseAssignGrade(page({ graded: true, grade: '<img src="x.png"> 85' }))).toEqual({ kind: 'unknown' });
    expect(parseAssignGrade(page({ graded: true, grade: 'x'.repeat(80) }))).toEqual({ kind: 'unknown' });
    expect(parseAssignGrade('<html><body><div id="region-main">Quiz</div></body></html>')).toEqual({ kind: 'unknown' });
  });
  it('does not turn a number with a thousands mark into a guess', () => {
    expect(parseAssignGrade(page({ graded: true, grade: '1.000,00 / 1.000,00' }))).toEqual({ kind: 'graded', text: '1.000,00 / 1.000,00', got: null, max: null, letter: null });
  });
});

describe('the assignment page address', () => {
  it('is the student view by id', () => {
    expect(assignViewPath(70)).toBe('/mod/assign/view.php?id=70');
    expect(isReadOnlyAssignUrl(assignViewPath(70))).toBe(true);
  });
  it.each([
    '/mod/assign/view.php?id=70&action=editsubmission',
    '/mod/assign/view.php?id=70&action=removesubmission&sesskey=abc',
    '/mod/assign/view.php?action=grading&id=70',
    '/mod/assign/view.php?id=70&id=71',
    '/mod/assign/view.php?id=-1',
    '/mod/assign/view.php?id=abc',
    '/mod/assign/view.php',
    '/mod/assign/index.php?id=70',
    '/mod/quiz/view.php?id=70',
  ])('refuses %s', (path) => {
    expect(isReadOnlyAssignUrl(path)).toBe(false);
  });
});

describe('what the "Nilai" part shows', () => {
  const NOW = 1_800_000_000;
  const base = { eventId: 7, cmId: 70, courseId: 1 as import('@sulo/core/types').CourseId, name: 'Laporan', module: 'assign', dueAt: NOW - 60, url: '', overdue: false, firstSeenAt: 0, lastSeenAt: 0, missingSince: null };
  it('only for an assignment handed in and graded on SIKOLA', async () => {
    const { gradedCmIds, showsGradeCard } = await import('@sulo/core/tasks/grade-view');
    const news = (kind: 'grade_feedback' | 'forum', contexturl: string | null) => ({
      id: 'x', at: NOW, notify: true, seen: false, opens: 0,
      change: { kind, courseId: null, notification: { id: 1, subject: 'x', component: 'mod_assign', eventtype: 'assign_notification', timecreated: NOW, read: false, contexturl } },
    });
    const graded = gradedCmIds([
      news('grade_feedback', 'https://sikola-v2.unhas.ac.id/mod/assign/view.php?id=70'),
      news('grade_feedback', 'https://sikola-v2.unhas.ac.id/mod/quiz/view.php?id=71'),
      news('forum', 'https://sikola-v2.unhas.ac.id/mod/assign/view.php?id=72'),
      news('grade_feedback', null),
    ]);
    expect([...graded]).toEqual([70]);
    const handedIn = { ...base, missingSince: NOW - 60 };
    expect(showsGradeCard(handedIn, graded)).toBe(true);
    // Still on SIKOLA's to-do list (not handed in), even if marked done in Sulo.
    expect(showsGradeCard(base, graded)).toBe(false);
    // Handed in, no grade or feedback news yet.
    expect(showsGradeCard({ ...handedIn, cmId: 73 }, graded)).toBe(false);
    expect(showsGradeCard({ ...handedIn, module: 'quiz' }, graded)).toBe(false);
  });
  it('writes points in the reader\'s number format', async () => {
    const { gradeLine } = await import('@sulo/core/tasks/grade-view');
    const ok = { status: 'ok' as const, grade: { kind: 'graded' as const, text: '85,50 / 100,00', got: 85.5, max: 100, letter: null }, fetchedAt: NOW, cached: false };
    expect(gradeLine(ok, 'id-ID')).toEqual({ kind: 'value', text: '85,5 / 100', fetchedAt: NOW });
    expect(gradeLine(ok, 'en-US')).toEqual({ kind: 'value', text: '85.5 / 100', fetchedAt: NOW });
    expect(gradeLine({ ...ok, grade: { kind: 'graded', text: '90.00 (A)', got: 90, max: null, letter: 'A' } }, 'id-ID')).toMatchObject({ text: '90 (A)' });
    expect(gradeLine({ ...ok, grade: { kind: 'graded', text: 'Sangat baik', got: null, max: null, letter: null } }, 'id-ID')).toMatchObject({ text: 'Sangat baik' });
  });
  it('names an ended session, a wait, and everything else as a failure with SIKOLA\'s page', async () => {
    const { gradeLine } = await import('@sulo/core/tasks/grade-view');
    expect(gradeLine({ status: 'failed', reason: 'SESSION_EXPIRED' }, 'id-ID')).toEqual({ kind: 'expired' });
    expect(gradeLine({ status: 'failed', reason: 'login_required' }, 'id-ID')).toEqual({ kind: 'expired' });
    expect(gradeLine({ status: 'cooldown', retryAt: NOW }, 'id-ID')).toEqual({ kind: 'wait' });
    expect(gradeLine({ status: 'failed', reason: 'BUDGET_EXHAUSTED' }, 'id-ID')).toEqual({ kind: 'failed' });
    expect(gradeLine({ status: 'account_mismatch' }, 'id-ID')).toEqual({ kind: 'failed' });
    expect(gradeLine({ status: 'ok', grade: { kind: 'unknown' }, fetchedAt: NOW, cached: true }, 'id-ID')).toEqual({ kind: 'unknown' });
  });
});
