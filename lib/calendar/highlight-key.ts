// Storage key and shape of the popup's "Tanggal penting" line. No imports on
// purpose: the popup reads this without pulling in the calendar or its schema.

export const CALENDAR_HIGHLIGHT_KEY = 'global:calendarHighlight';

export interface CalendarHighlight {
  id: string;
  judul: string;
  mulai: string;
  selesai: string | null;
}
