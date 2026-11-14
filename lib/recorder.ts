// Fixture recorder (dev builds only). Calls all five allowlisted functions in
// two batches through the normal client, then sanitizes everything before it
// leaves the service worker. Recording never depends on schema validation:
// responses that fail validation are kept, with the issue paths attached,
// so the fixtures can be used to correct the schemas.

import { calls, type AllowedFunction, type MoodleCall } from './moodle/calls';
import type { CallResult, MoodleClient } from './moodle/client';
import { FUNCTION_SCHEMAS, describeIssues } from './moodle/schemas';
import { sanitizeJson } from './sanitize/json';
import { leakReport } from './sanitize/leaks';
import type { Clock } from './types';

export interface RecordedCall {
  methodname: AllowedFunction;
  args: unknown;
  ok: boolean;
  errorcode: string | null;
  schema: { valid: boolean; issues: string[] };
  data: unknown;
}

export interface RecordedFile {
  filename: string;
  content: string;
}

export type RecordOutcome =
  | { kind: 'ok'; files: RecordedFile[] }
  | { kind: 'failed'; reason: string }
  | { kind: 'leak_detected'; rules: string[] };

const FILE_SLUG: Record<AllowedFunction, string> = {
  core_session_time_remaining: 'session-time-remaining',
  core_calendar_get_action_events_by_timesort: 'calendar-action-events',
  core_courseformat_get_state: 'courseformat-state',
  message_popup_get_popup_notifications: 'popup-notifications',
  core_course_get_enrolled_courses_by_timeline_classification: 'enrolled-courses',
};

export async function recordFixtures(deps: {
  client: MoodleClient;
  clock: Clock;
  origin: string;
  /** Random per recording; supplied by the caller to keep this module pure. */
  timeShiftSeconds: number;
}): Promise<RecordOutcome> {
  const now = deps.clock.now();
  const first: MoodleCall[] = [calls.sessionTimeRemaining(), calls.enrolledCourses(), calls.calendarActionEvents(now)];
  const batch1 = await deps.client.callBatch(first);
  if (batch1.kind !== 'ok') return { kind: 'failed', reason: describeOutcome(batch1) };

  const [session, courses, calendar] = batch1.results;
  const userId = readNumber(session, ['userid']);
  const courseId = pickCourseId(courses, calendar);
  const second: MoodleCall[] = [];
  if (courseId !== null) second.push(calls.courseformatState(courseId));
  if (userId !== null) second.push(calls.popupNotifications(userId));

  let batch2Results: CallResult[] = [];
  if (second.length > 0) {
    const batch2 = await deps.client.callBatch(second);
    if (batch2.kind !== 'ok') return { kind: 'failed', reason: describeOutcome(batch2) };
    batch2Results = batch2.results;
  }

  const allCalls = [...first, ...second];
  const allResults = [...batch1.results, ...batch2Results];
  const recorded = allCalls.map((call, i) => toRecorded(call, allResults[i]));

  // One sanitize pass over all payloads keeps remapped ids consistent across
  // files. Metadata (method names, schema issue paths) is ours, not SIKOLA's,
  // and is left untouched.
  const payloads = recorded.map(({ args, data }) => ({ args, data }));
  const cleanPayloads = sanitizeJson(payloads, { timeShiftSeconds: deps.timeShiftSeconds, origin: deps.origin }) as {
    args: unknown;
    data: unknown;
  }[];
  const clean: RecordedCall[] = recorded.map((entry, i) => ({ ...entry, ...cleanPayloads[i] }));
  const leaks = leakReport(clean);
  if (leaks.length > 0) return { kind: 'leak_detected', rules: leaks };

  return {
    kind: 'ok',
    files: clean.map((entry) => ({
      filename: `${FILE_SLUG[entry.methodname]}.recorded.json`,
      content: `${JSON.stringify(entry, null, 2)}\n`,
    })),
  };
}

function toRecorded(call: MoodleCall, result: CallResult | undefined): RecordedCall {
  const methodname = call.methodname as AllowedFunction;
  if (!result) {
    return { methodname, args: call.args, ok: false, errorcode: 'missing_result', schema: { valid: false, issues: [] }, data: null };
  }
  if (!result.ok) {
    return { methodname, args: call.args, ok: false, errorcode: result.errorcode, schema: { valid: false, issues: [] }, data: null };
  }
  const parsed = FUNCTION_SCHEMAS[methodname].safeParse(result.data);
  return {
    methodname,
    args: call.args,
    ok: true,
    errorcode: null,
    schema: { valid: parsed.success, issues: parsed.success ? [] : describeIssues(parsed.error) },
    data: result.data,
  };
}

function describeOutcome(outcome: { kind: string; reason?: string; status?: number }): string {
  if (outcome.kind === 'refused' && outcome.reason) return `refused: ${outcome.reason}`;
  if (outcome.kind === 'http_error' && outcome.status) return `http ${outcome.status}`;
  return outcome.kind;
}

// Defensive raw readers: the recorder must work even when schemas do not match.

function readNumber(result: CallResult | undefined, path: string[]): number | null {
  if (!result?.ok) return null;
  let node: unknown = result.data;
  for (const key of path) {
    if (node === null || typeof node !== 'object') return null;
    node = (node as Record<string, unknown>)[key];
  }
  return typeof node === 'number' && Number.isInteger(node) ? node : null;
}

/** Most recently started visible course; falls back to a course from the calendar. */
function pickCourseId(courses: CallResult | undefined, calendar: CallResult | undefined): number | null {
  const list = courses?.ok ? (courses.data as { courses?: unknown }).courses : undefined;
  if (Array.isArray(list)) {
    const candidates = list
      .filter((c): c is { id: number; startdate?: number; hidden?: boolean } => typeof c?.id === 'number')
      .filter((c) => c.hidden !== true)
      .sort((a, b) => (b.startdate ?? 0) - (a.startdate ?? 0));
    if (candidates[0]) return candidates[0].id;
  }
  const events = calendar?.ok ? (calendar.data as { events?: unknown }).events : undefined;
  if (Array.isArray(events)) {
    const withCourse = events.find((e) => typeof e?.course?.id === 'number');
    if (withCourse) return withCourse.course.id as number;
  }
  return null;
}
