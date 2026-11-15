// Moodle popup notifications -> change entries. Pure.
// - Baseline: the first fetch only records the highest id; nothing is logged.
//   Afterwards only ids above it are processed.
// - Kept fields: id, subject, component, eventtype, timecreated, read and a
//   filtered contexturl. customdata is read once for the course id (only the
//   number is kept) and dropped. Bodies never pass validation (schemas.ts).
// - Sulo never marks Moodle notifications as read.

import type { FunctionData } from '../moodle/schemas';
import type { Change, CourseId, KeptNotification } from '../types';
import { notificationKind } from './notification-kinds';

type RawNotification = FunctionData<'message_popup_get_popup_notifications'>['notifications'][number];

/** Pages a notification may link to. Anything else is dropped (null). */
const CONTEXT_PATHS = [
  /^\/mod\/[a-z]+\/view\.php$/,
  /^\/mod\/forum\/discuss\.php$/,
  /^\/mod\/assign\/view\.php$/,
  /^\/grade\/report\/[a-z]+\/index\.php$/,
  /^\/course\/view\.php$/,
];
/** Only id-like query parameters survive: course, module, discussion, forum, post. */
const KEPT_PARAMS = ['id', 'd', 'f', 'p'];

export function filterContextUrl(raw: string | null | undefined, origin: string): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.origin !== origin || !CONTEXT_PATHS.some((p) => p.test(url.pathname))) return null;
  const clean = new URL(url.pathname, origin);
  for (const key of KEPT_PARAMS) {
    const value = url.searchParams.get(key);
    if (value !== null && /^\d+$/.test(value)) clean.searchParams.set(key, value);
  }
  // A forum post anchor (#p123) is kept; any other fragment is dropped.
  if (/^#p\d+$/.test(url.hash)) clean.hash = url.hash;
  return clean.toString();
}

/** Reads customdata.courseid once; anything unreadable gives null (the entry is still logged). */
export function courseIdFromCustomdata(customdata: string | null | undefined): CourseId | null {
  if (!customdata) return null;
  try {
    const data = JSON.parse(customdata) as unknown;
    const value = data && typeof data === 'object' ? (data as Record<string, unknown>).courseid : undefined;
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function keepNotification(raw: RawNotification, origin: string): KeptNotification {
  return {
    id: raw.id,
    subject: raw.subject,
    component: raw.component,
    eventtype: raw.eventtype,
    timecreated: raw.timecreated,
    read: raw.read,
    contexturl: filterContextUrl(raw.contexturl, origin),
  };
}

export interface NotificationScan {
  changes: Change[];
  /** Highest id seen so far (stored; the baseline for the next scan). */
  lastId: number;
  baseline: boolean;
}

export function scanNotifications(raw: readonly RawNotification[], lastId: number | null, origin: string): NotificationScan {
  const highest = raw.reduce((max, n) => Math.max(max, n.id), lastId ?? 0);
  if (lastId === null) return { changes: [], lastId: highest, baseline: true };
  const changes = raw
    .filter((n) => n.id > lastId)
    .sort((a, b) => a.id - b.id)
    .map((n): Change => {
      const notification = keepNotification(n, origin);
      const courseId = courseIdFromCustomdata(n.customdata);
      const kind = notificationKind(n.component, n.eventtype);
      return { kind: kind === 'other' ? 'other_notification' : kind, courseId, notification };
    });
  return { changes, lastId: highest, baseline: false };
}
