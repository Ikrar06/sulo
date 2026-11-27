// "Tambah ke Google Calendar": a Google Calendar event template link, opened
// in a new tab by the user's click. Sulo sends nothing: the browser opens a
// URL, and the user decides in Google Calendar whether to save the event.
// No permission, no login.

import type { UnixSeconds } from '../types';
import { EVENT_MINUTES, taskEvent, type EventTask } from './task-event';

export const GCAL_TEMPLATE_URL = 'https://calendar.google.com/calendar/render';


/** 20261114T155900Z: the UTC form the template link expects. */
function gcalTime(at: UnixSeconds): string {
  return new Date(at * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export interface CalendarTask {
  title: string;
  dueAt: UnixSeconds;
  details: string;
}


/** The task's SIKOLA link, rebuilt from checked parts only (now with the event it belongs to). */
export { cleanTaskLink } from './task-event';

/**
 * The link for one task: the title with its course, the due time, then
 * "Tugas {course} di SIKOLA." and the task's cleaned SIKOLA link on its own
 * line. Nothing else: no grade, no student number (the same on the popup,
 * the dashboard and the phone).
 */
export function taskCalendarUrl(task: EventTask, details: (course: string) => string): string {
  const event = taskEvent(task, details);
  return googleCalendarUrl({ title: event.title, dueAt: event.endAt, details: event.notes });
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
