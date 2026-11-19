// "Tambah ke Google Calendar": a Google Calendar event template link, opened
// in a new tab by the user's click. Sulo sends nothing: the browser opens a
// URL, and the user decides in Google Calendar whether to save the event.
// No permission, no login.

import { SIKOLA_ORIGIN } from '../moodle/limits';
import { TASK_MODULES } from '../radar/task-modules';
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

/** Longest title and course name kept in the link (a long task name never makes an unusable URL). */
const MAX_NAME = 200;
const MAX_COURSE = 120;
const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/**
 * A task's SIKOLA link, rebuilt from checked parts only:
 * https://sikola-v2.unhas.ac.id/mod/<task module>/view.php?id=<number>.
 * Any other parameter (sesskey, a token, anything) is dropped; another host,
 * path, module or a missing id gives null (the event then has no link).
 */
export function cleanTaskLink(url: string | null | undefined): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.origin !== SIKOLA_ORIGIN) return null;
  const mod = /^\/mod\/([a-z0-9]+)\/view\.php$/.exec(parsed.pathname)?.[1];
  if (!mod || !TASK_MODULES.has(mod)) return null;
  const id = parsed.searchParams.get('id');
  if (!id || !/^\d{1,10}$/.test(id)) return null;
  return `${SIKOLA_ORIGIN}/mod/${mod}/view.php?id=${id}`;
}

/**
 * The link for one task: the title with its course, the due time, then
 * "Tugas {course} di SIKOLA." and the task's cleaned SIKOLA link on its own
 * line. Nothing else: no grade, no student number (the same on the popup,
 * the dashboard and the phone).
 */
export function taskCalendarUrl(task: { name: string; courseName: string; dueAt: UnixSeconds; url?: string | null }, details: (course: string) => string): string {
  const course = clip(task.courseName, MAX_COURSE);
  const link = cleanTaskLink(task.url);
  return googleCalendarUrl({ title: `${clip(task.name, MAX_NAME)} (${course})`, dueAt: task.dueAt, details: link ? `${details(course)}\n${link}` : details(course) });
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
