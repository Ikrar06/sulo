// The popup's "Tanggal penting" line. The background computes it from the
// calendar and stores only these few fields, so the popup never loads the
// calendar data or its schema (popup bundle stays small).

import { calendarStatus } from './status.ts';
import type { CalendarFile } from './schema.ts';
import { nextImportant } from './upcoming.ts';
import type { CalendarHighlight } from './highlight-key.ts';

export { CALENDAR_HIGHLIGHT_KEY, type CalendarHighlight } from './highlight-key.ts';

/** Null when nothing is coming up, or when the calendar is out of date. */
export function calendarHighlight(file: CalendarFile, today: string): CalendarHighlight | null {
  if (calendarStatus(file, today).kind !== 'ok') return null;
  const next = nextImportant(file, today);
  if (!next) return null;
  const { id, judul, mulai, selesai } = next.kegiatan;
  return { id, judul, mulai, selesai };
}
