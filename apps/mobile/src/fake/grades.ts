// pnpm mobile:web only: "Lihat nilai" against made-up SIKOLA pages, so the demo runs the real path (the
// client's allowlist, the account check, the parsers, the saving and the auto-done) with nothing leaving the
// browser. A course's grade report lists its assignments: past ones graded "8x,00 (A)", every third one not
// graded yet. ?grade=unknown answers with a page Sulo does not recognize; ?grade=slow never answers.

import { isAllowedPage } from '@sulo/core/moodle/calls';
import type { MoodleClient, PageOutcome } from '@sulo/core/moodle/client';
import { currentUser, readUser } from '@sulo/core/storage';
import { COURSE_REPORT_PATH } from '@sulo/core/tasks/course-grades';
import { ASSIGN_PATH } from '@sulo/core/tasks/grade';
import type { KeyValueStore } from '@sulo/core/types';

const navbar = (userId: number) => `<nav><div class="popover-region" data-userid="${userId}"></div></nav>`;

/** A made-up grade for a task: every third one not graded yet. */
const gradeFor = (eventId: number) => (eventId % 3 === 0 ? '-' : `${80 + (eventId % 15)},00 (${eventId % 15 > 9 ? 'A' : 'A-'})`);

export function fakeGradesClient(store: KeyValueStore): MoodleClient {
  const page = async (path: string): Promise<PageOutcome> => {
    const url = new URL(path, 'https://sikola-v2.unhas.ac.id');
    if (!isAllowedPage(url.pathname)) return { kind: 'refused', reason: 'NOT_ALLOWLISTED' };
    const mode = new URLSearchParams(location.search).get('grade');
    if (mode === 'slow') return new Promise(() => undefined);
    if (mode === 'unknown') return { kind: 'ok', html: `${navbar(1)}<div id="region-main"><p>Halaman lain</p></div>` };
    const userId = (await currentUser(store)) ?? 1;
    const tasks = await readUser(store, userId, 'tasks');
    const id = Number(url.searchParams.get('id'));
    await new Promise((resolve) => setTimeout(resolve, 600));
    if (url.pathname === COURSE_REPORT_PATH) {
      const rows = tasks
        .filter((t) => t.courseId === id && t.module === 'assign' && t.cmId !== null)
        .map((t) => `<tr><th class="level2 column-itemname"><a class="gradeitemheader" href="https://sikola-v2.unhas.ac.id/mod/assign/view.php?id=${t.cmId}">${t.name}</a></th><td class="level2 column-weight">10,00 %</td><td class="level2 column-grade">${gradeFor(t.eventId)}</td><td class="level2 column-range">0–100</td><td class="level2 column-feedback">&nbsp;</td></tr>`)
        .join('');
      return { kind: 'ok', html: `${navbar(userId)}<div id="region-main"><table class="generaltable boxaligncenter user-grade"><thead><tr><th class="header column-itemname">Item</th><th class="header column-grade">Grade</th></tr></thead><tbody>${rows}</tbody></table></div>` };
    }
    if (url.pathname === ASSIGN_PATH) {
      const task = tasks.find((t) => t.cmId === id);
      const grade = task ? gradeFor(task.eventId) : '-';
      return { kind: 'ok', html: `${navbar(userId)}<div id="region-main"><div class="box py-3 boxaligncenter feedbacktable"><table class="generaltable"><tr><th class="cell c0">Grade</th><td class="cell c1">${grade}</td></tr></table></div></div>` };
    }
    return { kind: 'refused', reason: 'NOT_ALLOWLISTED' };
  };
  return { callBatch: async () => ({ kind: 'network_error' }), fetchPage: (path) => page(path) };
}
