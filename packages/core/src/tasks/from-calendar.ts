import type { FunctionData } from '../moodle/schemas';
import type { CourseId, Task, UnixSeconds } from '../types';

type CalendarEvent = FunctionData<'core_calendar_get_action_events_by_timesort'>['events'][number];

const DAY = 86_400;
/**
 * A task no longer in SIKOLA's calendar stays until its course ends, plus this long for grades given at the end
 * of the semester (owner's decision, 27 Nov 2026), so "Lihat nilai" and the finished filters keep it.
 */
export const SEMESTER_GRACE_DAYS = 30;
/** Without a usable course end date: this long after the due date (or after the task went missing). */
export const SEMESTER_FALLBACK_DAYS = 180;
/** Never longer than this after the due date, whatever the course end says. */
export const KEEP_MAX_DAYS = 240;

/** Until when a task that left SIKOLA's calendar is kept. `courseEnd`: the course's end date, null when unset. */
export function keepUntil(task: Pick<Task, 'dueAt' | 'missingSince' | 'firstSeenAt'>, courseEnd: UnixSeconds | null): UnixSeconds {
  const base = task.dueAt ?? task.missingSince ?? task.firstSeenAt;
  const fromCourse = courseEnd !== null && courseEnd > base ? courseEnd + SEMESTER_GRACE_DAYS * DAY : null;
  return Math.min(base + KEEP_MAX_DAYS * DAY, fromCourse ?? base + SEMESTER_FALLBACK_DAYS * DAY);
}

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
 * - Present in the calendar: updated (and active again, whatever it was).
 * - Missing but due inside the requested window: "probably submitted" (missingSince).
 * - Missing because its due date left the window first: "past" (missingSince and pastWindow), since Sulo
 *   cannot tell whether it was handed in.
 * - Either is kept until keepUntil (the course's end plus a grace, for late grades), never deleted at once.
 */
export function mergeTasks(
  previous: readonly Task[],
  events: readonly CalendarEvent[],
  now: UnixSeconds,
  lookbackDays: number,
  courseEnds: ReadonlyMap<CourseId, UnixSeconds | null> = new Map(),
): Task[] {
  const prevById = new Map(previous.map((t) => [t.eventId, t]));
  const fresh = events.map((e) => taskFromEvent(e, now, prevById.get(e.id)));
  const freshIds = new Set(fresh.map((t) => t.eventId));
  const start = windowStart(now, lookbackDays);

  const missing = previous
    .filter((t) => !freshIds.has(t.eventId))
    .map((t): Task => {
      // Already gone: as it was (probably submitted, or past).
      if (t.missingSince !== null) return t;
      return t.dueAt !== null && t.dueAt < start ? { ...t, missingSince: now, pastWindow: true } : { ...t, missingSince: now };
    })
    .filter((t) => now <= keepUntil(t, courseEnds.get(t.courseId) ?? null));

  return [...fresh, ...missing];
}

export function upcomingCourseIds(tasks: readonly Task[], now: UnixSeconds): Set<CourseId> {
  return new Set(tasks.filter((t) => t.missingSince === null && t.dueAt !== null && t.dueAt >= now).map((t) => t.courseId));
}
