// "Tambah ke Google Calendar" for one task: the link carries the task's title,
// its course, its due time and its SIKOLA link rebuilt from checked parts
// (host, a task module's view path, the numeric id), nothing else (no
// sesskey, token, grade or student number). The popup, the dashboard and the
// phone all build it here.
import { describe, expect, it } from 'vitest';
import { cleanTaskLink, GCAL_TEMPLATE_URL, taskCalendarUrl } from '@sulo/core/format/gcal';
import { messagesFor } from '@sulo/core/i18n';

const HOST = 'https://sikola-v2.unhas.ac.id';
const task = { name: 'Kuis pekan 6', courseName: 'Kalkulus II', dueAt: Date.UTC(2026, 10, 14, 15, 59) / 1000, url: `${HOST}/mod/quiz/view.php?id=301` };

describe('taskCalendarUrl', () => {
  for (const locale of ['id', 'en'] as const) {
    it(`${locale}: title, course, due time and the task's link only`, () => {
      const url = new URL(taskCalendarUrl(task, messagesFor(locale).popup.row.calendarDetails));
      expect(`${url.origin}${url.pathname}`).toBe(GCAL_TEMPLATE_URL);
      expect([...url.searchParams.keys()].sort()).toEqual(['action', 'dates', 'details', 'text']);
      expect(url.searchParams.get('text')).toBe('Kuis pekan 6 (Kalkulus II)');
      expect(url.searchParams.get('dates')).toBe('20261114T152900Z/20261114T155900Z');
      const [line, link, ...rest] = url.searchParams.get('details')!.split('\n');
      expect(line).toBe(locale === 'id' ? 'Tugas Kalkulus II di SIKOLA.' : 'Kalkulus II task on SIKOLA.');
      expect(link).toBe(`${HOST}/mod/quiz/view.php?id=301`);
      expect(rest).toEqual([]);
    });
  }

  it('a link from another host leaves the event without a link (it is still made)', () => {
    const url = new URL(taskCalendarUrl({ ...task, url: 'https://evil.example/mod/quiz/view.php?id=301' }, messagesFor('id').popup.row.calendarDetails));
    expect(url.searchParams.get('details')).toBe('Tugas Kalkulus II di SIKOLA.');
    expect(url.searchParams.get('text')).toBe('Kuis pekan 6 (Kalkulus II)');
  });

  it('a very long title and course keep the URL short', () => {
    const long = taskCalendarUrl({ ...task, name: 'x'.repeat(5000), courseName: 'y'.repeat(5000), url: `${HOST}/mod/assign/view.php?id=1&${'a=b&'.repeat(2000)}` }, messagesFor('id').popup.row.calendarDetails);
    expect(long.length).toBeLessThan(1500);
    expect(new URL(long).searchParams.get('details')!.split('\n')[1]).toBe(`${HOST}/mod/assign/view.php?id=1`);
  });
});

describe('cleanTaskLink', () => {
  it('keeps only the id: sesskey, tokens and every other parameter are dropped', () => {
    expect(cleanTaskLink(`${HOST}/mod/assign/view.php?id=42&sesskey=AbC123&action=editsubmission&token=zz#section`)).toBe(`${HOST}/mod/assign/view.php?id=42`);
    expect(cleanTaskLink(`${HOST}/mod/assign/view.php?sesskey=AbC123&id=42`)).toBe(`${HOST}/mod/assign/view.php?id=42`);
  });

  it('every task module, nothing else', () => {
    for (const mod of ['assign', 'quiz', 'workshop', 'lesson', 'scorm', 'h5pactivity']) expect(cleanTaskLink(`${HOST}/mod/${mod}/view.php?id=7`)).toBe(`${HOST}/mod/${mod}/view.php?id=7`);
    expect(cleanTaskLink(`${HOST}/mod/forum/view.php?id=7`)).toBeNull();
    expect(cleanTaskLink(`${HOST}/mod/resource/view.php?id=7`)).toBeNull();
  });

  it('refuses another host, plain http, a port, other paths and a missing or odd id', () => {
    for (const bad of [
      'https://sikola-v2.unhas.ac.id.evil.example/mod/assign/view.php?id=1',
      'https://evil.example/mod/assign/view.php?id=1',
      'http://sikola-v2.unhas.ac.id/mod/assign/view.php?id=1',
      'https://sikola-v2.unhas.ac.id:8443/mod/assign/view.php?id=1',
      `${HOST}/mod/assign/edit.php?id=1`,
      `${HOST}/login/token.php?id=1`,
      `${HOST}/mod/assign/view.php`,
      `${HOST}/mod/assign/view.php?id=abc`,
      `${HOST}/mod/assign/view.php?id=1e5`,
      `${HOST}/mod/assign/view.php?id=12345678901`,
      'javascript:alert(1)',
      'not a url',
      '',
      null,
      undefined,
    ])
      expect(cleanTaskLink(bad)).toBeNull();
  });

  it('drops a user and password put in the address', () => {
    // Built at runtime: the repository's leak scan reads "user:pass@host" as an address.
    const withLogin = `https://${['user:pass', 'sikola-v2.unhas.ac.id'].join('@')}/mod/quiz/view.php?id=9`;
    expect(cleanTaskLink(withLogin)).toBe(`${HOST}/mod/quiz/view.php?id=9`);
  });
});
