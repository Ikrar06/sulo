import type { FunctionData } from '../moodle/schemas';
import type { CourseId, Task, UnixSeconds } from '../types';

type CalendarEvent = FunctionData<'core_calendar_get_action_events_by_timesort'>['events'][number];

const DAY = 86_400;
/** Tasks missing from the calendar are kept this long as "probably submitted". */
export const MISSING_RETENTION_DAYS = 14;

function cmIdFromUrl(url: string): number | null {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith('/mod/')) return null;
    const id = Number(parsed.searchParams.get('id'));
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

function actionUrl(action: unknown): string | null {
  if (action && typeof action === 'object' && typeof (action as { url?: unknown }).url === 'string') {
    return (action as { url: string }).url;
  }
  return null;
}

/**
 * One task per calendar action event. The kind comes from `modulename`
 * (a code such as "assign" or "quiz"), never from translated text. Quiz
 * deadlines are tasks too; Sulo never reads quiz content.
 */
export function taskFromEvent(event: CalendarEvent, now: UnixSeconds, previous?: Task): Task {
  const url = event.url || actionUrl(event.action) || '';
  return {
    eventId: event.id,
    cmId: cmIdFromUrl(url),
    courseId: event.course.id,
    // The activity name, without Moodle's translated suffix; the event name as fallback.
    name: event.activityname?.trim() || event.name,
    module: event.modulename ?? 'unknown',
    dueAt: event.timesort > 0 ? event.timesort : null,
    url,
    overdue: event.overdue,
    firstSeenAt: previous?.firstSeenAt ?? now,
    lastSeenAt: now,
    missingSince: null,
  };
}

/** Lower bound of the calendar window requested by the sync. */
export const windowStart = (now: UnixSeconds, lookbackDays: number) => now - lookbackDays * DAY;

/**
 * Merges a fresh calendar result into the stored tasks.
 * - Present in the calendar: updated.
 * - Missing but due inside the requested window: kept as "probably
 *   submitted" (missingSince) for MISSING_RETENTION_DAYS, never deleted at once.
 * - Missing because it fell out of the window (due before its start): dropped.
 */
export function mergeTasks(
  previous: readonly Task[],
  events: readonly CalendarEvent[],
  now: UnixSeconds,
  lookbackDays: number,
): Task[] {
  const prevById = new Map(previous.map((t) => [t.eventId, t]));
  const fresh = events.map((e) => taskFromEvent(e, now, prevById.get(e.id)));
  const freshIds = new Set(fresh.map((t) => t.eventId));
  const start = windowStart(now, lookbackDays);

  const missing = previous
    .filter((t) => !freshIds.has(t.eventId))
    .filter((t) => t.dueAt === null || t.dueAt >= start)
    .map((t) => (t.missingSince === null ? { ...t, missingSince: now } : t))
    .filter((t) => now - (t.missingSince ?? now) <= MISSING_RETENTION_DAYS * DAY);

  return [...fresh, ...missing];
}

export function upcomingCourseIds(tasks: readonly Task[], now: UnixSeconds): Set<CourseId> {
  return new Set(tasks.filter((t) => t.missingSince === null && t.dueAt !== null && t.dueAt >= now).map((t) => t.courseId));
}
