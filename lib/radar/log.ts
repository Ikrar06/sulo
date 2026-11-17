// The change log ("Kabar terbaru"): at most 200 newest entries per user.
// Decides once, when logging, whether an entry may notify; the user's
// settings and quiet hours are applied later by the notification planner.
// Pure.

import type { Change, ChangeLogEntry, UnixSeconds } from '../types';

export const LOG_LIMIT = 200;
/** A task due further out than this is not "new": it just entered the 90-day calendar window. */
export const FAR_TASK_DAYS = 85;
/** The "baru" marker on a task row lasts this long, or this many popup opens. */
export const NEW_MARKER_SECONDS = 24 * 3600;
export const NEW_MARKER_OPENS = 3;

export function entryId(change: Change): string {
  switch (change.kind) {
    case 'task_added':
      return `task:${change.eventId}:added`;
    case 'due_changed':
      return `task:${change.eventId}:due:${change.to ?? 'none'}`;
    case 'grade_feedback':
    case 'forum':
    case 'other_notification':
      return `note:${change.notification.id}`;
    case 'renamed':
      return `cm:${change.courseId}:${change.cmId}:renamed:${change.since}:${change.to}`;
    default:
      // Derived from the content and the snapshot compared against, never
      // from the current time: the same change seen twice is one entry.
      return `cm:${change.courseId}:${change.cmId}:${change.kind}:${change.since}`;
  }
}

/** The activity id a change refers to, to avoid two "new" items for one task. */
const cmOf = (c: Change): number | null => ('cmId' in c ? c.cmId : null);

function mayNotify(change: Change, log: readonly ChangeLogEntry[], batch: readonly Change[], now: UnixSeconds): boolean {
  switch (change.kind) {
    case 'added':
    case 'shown': {
      if (change.module === 'label') return false;
      // The same activity already announced as a new task (calendar first): log only.
      const cm = change.cmId;
      const announced = [...log.map((e) => e.change), ...batch].some((c) => c.kind === 'task_added' && c.cmId === cm);
      return !announced;
    }
    case 'task_added': {
      if (change.dueAt !== null && change.dueAt - now > FAR_TASK_DAYS * 86_400) return false;
      const cm = change.cmId;
      if (cm === null) return true;
      // Already announced as new material from the course structure: log only.
      return !log.some((e) => e.notify && (e.change.kind === 'added' || e.change.kind === 'shown') && cmOf(e.change) === cm);
    }
    case 'due_changed':
    case 'grade_feedback':
    case 'forum':
      return true;
    default:
      // removed, hidden, renamed, other notifications: log only.
      return false;
  }
}

/** A new activity logged this recently is the same news as its task, when the deadline arrives later. */
export const MERGE_WINDOW_SECONDS = 24 * 3600;

const isNewActivity = (c: Change) => c.kind === 'added' || c.kind === 'shown';

/**
 * Adds a cycle's changes. A task is one piece of news, however it is found:
 * - the calendar's new task and the course structure's new activity with
 *   the same cmId, in one cycle: only the task is kept;
 * - the activity was logged first (within 24 hours) and the task comes in a
 *   later cycle: that entry becomes the task, keeping its id, so it never
 *   notifies twice;
 * - the task was logged first: a later "new activity" for it is dropped.
 * Entry ids stay derived from the first change seen (deterministic).
 */
export function appendChanges(log: readonly ChangeLogEntry[], changes: readonly Change[], now: UnixSeconds): ChangeLogEntry[] {
  const taskCms = new Set<number>();
  for (const c of [...changes, ...log.map((e) => e.change)]) if (c.kind === 'task_added' && c.cmId !== null) taskCms.add(c.cmId);
  const kept = changes.filter((c) => !(isNewActivity(c) && taskCms.has(c.cmId)));

  let updated = log;
  const existing = new Set(log.map((e) => e.id));
  const fresh: ChangeLogEntry[] = [];
  for (const change of kept) {
    if (change.kind === 'task_added' && change.cmId !== null) {
      const earlier = updated.find((e) => isNewActivity(e.change) && cmOf(e.change) === change.cmId && now - e.at < MERGE_WINDOW_SECONDS);
      if (earlier) {
        updated = updated.map((e) => (e === earlier ? { ...e, change } : e));
        continue;
      }
    }
    const id = entryId(change);
    if (existing.has(id)) continue;
    existing.add(id);
    fresh.push({ id, at: now, change, notify: mayNotify(change, updated, kept, now), seen: false, opens: 0 });
  }
  // Newest cycle first; within one cycle, the order the changes were found.
  return [...fresh, ...updated].slice(0, LOG_LIMIT);
}

export const markAllSeen = (log: readonly ChangeLogEntry[]): ChangeLogEntry[] => log.map((e) => (e.seen ? e : { ...e, seen: true }));

const isTaskMarker = (e: ChangeLogEntry) => e.change.kind === 'task_added' || e.change.kind === 'due_changed';

export function isMarkerActive(e: ChangeLogEntry, now: UnixSeconds): boolean {
  return isTaskMarker(e) && now - e.at < NEW_MARKER_SECONDS && e.opens < NEW_MARKER_OPENS;
}

/** Counts a popup open against every active task marker. */
export function countPopupOpen(log: readonly ChangeLogEntry[], now: UnixSeconds): ChangeLogEntry[] {
  return log.map((e) => (isMarkerActive(e, now) ? { ...e, opens: e.opens + 1 } : e));
}

/** Task rows that show "baru" or "tenggat berubah". */
export function taskMarkers(log: readonly ChangeLogEntry[], now: UnixSeconds): Map<number, 'new' | 'due_changed'> {
  const markers = new Map<number, 'new' | 'due_changed'>();
  for (const e of log) {
    if (!isMarkerActive(e, now)) continue;
    const c = e.change;
    if ((c.kind === 'task_added' || c.kind === 'due_changed') && !markers.has(c.eventId)) {
      markers.set(c.eventId, c.kind === 'task_added' ? 'new' : 'due_changed');
    }
  }
  return markers;
}
