import { describe, expect, it } from 'vitest';
import { taskCalendarUrl } from '@sulo/core/format/gcal';
import { EVENT_MINUTES, taskEvent, taskIcs, taskIcsName } from '@sulo/core/format/task-event';

const DUE = Date.UTC(2026, 11, 2, 15, 59) / 1000;
const details = (course: string) => `Tugas ${course} di SIKOLA.`;
const task = { name: 'Laporan praktikum; aliran, pipa', courseName: 'Mekanika Fluida', dueAt: DUE, url: 'https://sikola-v2.unhas.ac.id/mod/assign/view.php?id=123&sesskey=abc' };

describe('one task as a calendar event, the same on every device', () => {
  it('ends at the due time, starts 30 minutes before, and keeps only the cleaned SIKOLA link', () => {
    const e = taskEvent(task, details);
    expect(e).toEqual({
      title: 'Laporan praktikum; aliran, pipa (Mekanika Fluida)',
      startAt: DUE - EVENT_MINUTES * 60,
      endAt: DUE,
      notes: 'Tugas Mekanika Fluida di SIKOLA.\nhttps://sikola-v2.unhas.ac.id/mod/assign/view.php?id=123',
      url: 'https://sikola-v2.unhas.ac.id/mod/assign/view.php?id=123',
    });
    expect(taskEvent({ ...task, url: 'https://elsewhere.test/mod/assign/view.php?id=1' }, details).url).toBeNull();
  });
  it('the Google link carries the same event', () => {
    const link = new URL(taskCalendarUrl(task, details));
    expect(link.searchParams.get('text')).toBe('Laporan praktikum; aliran, pipa (Mekanika Fluida)');
    expect(link.searchParams.get('dates')).toBe('20261202T152900Z/20261202T155900Z');
    expect(link.searchParams.get('details')).not.toContain('sesskey');
  });
  it('an .ics file a calendar app opens: escaped text, CRLF, the same times', () => {
    const ics = taskIcs(taskEvent(task, details), 'tugas-123@sulo', DUE - 86_400);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics).toContain('\r\nUID:tugas-123@sulo\r\n');
    expect(ics).toContain('\r\nDTSTART:20261202T152900Z\r\nDTEND:20261202T155900Z\r\n');
    expect(ics).toContain('SUMMARY:Laporan praktikum\\; aliran\\, pipa (Mekanika Fluida)');
    expect(ics).toContain('URL:https://sikola-v2.unhas.ac.id/mod/assign/view.php?id=123');
    expect(ics).not.toContain('sesskey');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
  it('names the file after the task, in plain letters', () => {
    expect(taskIcsName({ name: 'Laporan Praktikum Aliran (Pekan 3)' })).toBe('laporan-praktikum-aliran-pekan-3.ics');
    expect(taskIcsName({ name: '!!!' })).toBe('tugas.ics');
  });
});
