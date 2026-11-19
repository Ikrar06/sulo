// "Tambah ke Google Calendar" for one task: the link carries the task's title,
// its course and its due time, nothing else (no SIKOLA link, no grade, no
// student number). The popup, the dashboard and the phone all build it here.
import { describe, expect, it } from 'vitest';
import { GCAL_TEMPLATE_URL, taskCalendarUrl } from '@sulo/core/format/gcal';
import { messagesFor } from '@sulo/core/i18n';

const task = { name: 'Kuis pekan 6', courseName: 'Kalkulus II', dueAt: Date.UTC(2026, 10, 14, 15, 59) / 1000 };

describe('taskCalendarUrl', () => {
  for (const locale of ['id', 'en'] as const) {
    it(`${locale}: title, course and due time only`, () => {
      const url = new URL(taskCalendarUrl(task, messagesFor(locale).popup.row.calendarDetails));
      expect(`${url.origin}${url.pathname}`).toBe(GCAL_TEMPLATE_URL);
      expect([...url.searchParams.keys()].sort()).toEqual(['action', 'dates', 'details', 'text']);
      expect(url.searchParams.get('text')).toBe('Kuis pekan 6 (Kalkulus II)');
      expect(url.searchParams.get('dates')).toBe('20261114T152900Z/20261114T155900Z');
      const details = url.searchParams.get('details')!;
      expect(details).toContain('Kalkulus II');
      expect(details).not.toMatch(/https?:|sikola-v2|sesskey|token/i);
    });
  }
});
