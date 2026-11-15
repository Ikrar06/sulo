// "Tambah ke Google Calendar": a Google Calendar event template link, opened
// in a new tab by the user's click. Sulo sends nothing: the browser opens a
// URL, and the user decides in Google Calendar whether to save the event.
// No permission, no login.

import type { UnixSeconds } from '../types';

export const GCAL_TEMPLATE_URL = 'https://calendar.google.com/calendar/render';

/** The event ends at the due time and starts this much earlier. */
const EVENT_MINUTES = 30;

/** 20261114T155900Z: the UTC form the template link expects. */
function gcalTime(at: UnixSeconds): string {
  return new Date(at * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export interface CalendarTask {
  title: string;
  dueAt: UnixSeconds;
  details: string;
}

export function googleCalendarUrl({ title, dueAt, details }: CalendarTask): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${gcalTime(dueAt - EVENT_MINUTES * 60)}/${gcalTime(dueAt)}`,
    details,
  });
  return `${GCAL_TEMPLATE_URL}?${params.toString()}`;
}
