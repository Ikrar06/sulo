// One task as a calendar event, the same wherever it goes (1.1.0, owner 27 Nov 2026: "add it to my device's own
// calendar"): Google Calendar's template link (format/gcal.ts), an .ics file that a laptop's calendar app opens
// (Calendar on a Mac, Outlook on Windows), and the phone's own calendar (the iPhone's Calendar through iOS's add
// event sheet, Android's calendar app through its insert screen). The event ends at the due time and starts 30
// minutes before; the title carries the course; the notes say "Tugas {course} di SIKOLA." with the task's cleaned
// SIKOLA link. Nothing else: no grade, no student number. Pure.

import { escapeText, foldLine } from '../calendar/ics';
import { SIKOLA_ORIGIN } from '../moodle/limits';
import { TASK_MODULES } from '../radar/task-modules';
import type { UnixSeconds } from '../types';

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

/** The event ends at the due time and starts this much earlier. */
export const EVENT_MINUTES = 30;
/** Longest title and course name kept (a long task name never makes an unusable link or event). */
const MAX_NAME = 200;
const MAX_COURSE = 120;
const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export interface TaskEvent {
  title: string;
  startAt: UnixSeconds;
  endAt: UnixSeconds;
  /** "Tugas {course} di SIKOLA.", then the SIKOLA link on its own line when there is one. */
  notes: string;
  /** The task's SIKOLA link, rebuilt from checked parts only (cleanTaskLink), or null. */
  url: string | null;
}

export interface EventTask {
  name: string;
  courseName: string;
  dueAt: UnixSeconds;
  url?: string | null;
}

export function taskEvent(task: EventTask, details: (course: string) => string): TaskEvent {
  const course = clip(task.courseName, MAX_COURSE);
  const url = cleanTaskLink(task.url);
  return {
    title: `${clip(task.name, MAX_NAME)} (${course})`,
    startAt: task.dueAt - EVENT_MINUTES * 60,
    endAt: task.dueAt,
    notes: url ? `${details(course)}\n${url}` : details(course),
    url,
  };
}

export const TASK_ICS_PRODID = '-//Sulo//Tugas (tidak resmi)//ID';

/** 20261114T155900Z. */
function icsTime(at: UnixSeconds): string {
  return new Date(at * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/** A file name for the event: the task's name in plain letters, digits and dashes, never empty. */
export function taskIcsName(task: { name: string }): string {
  const slug = task.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `${slug || 'tugas'}.ics`;
}

/** One event as an .ics file (RFC 5545, CRLF, folded lines). `uid` stays the same for a task, so a second import updates it. */
export function taskIcs(event: TaskEvent, uid: string, stamp: UnixSeconds): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${TASK_ICS_PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsTime(stamp)}`,
    `DTSTART:${icsTime(event.startAt)}`,
    `DTEND:${icsTime(event.endAt)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.notes)}`,
    ...(event.url ? [`URL:${event.url}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
