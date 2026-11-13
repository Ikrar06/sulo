// Allowlist of Moodle web service functions. Read-only functions only.
// The client refuses any function not listed here (docs/ATURAN-REQUEST.md, rule 7).

export const ALLOWED_FUNCTIONS = [
  'core_session_time_remaining',
  'core_calendar_get_action_events_by_timesort',
  'core_courseformat_get_state',
  'message_popup_get_popup_notifications',
  'core_course_get_enrolled_courses_by_timeline_classification',
] as const;

export type AllowedFunction = (typeof ALLOWED_FUNCTIONS)[number];

export interface MoodleCall {
  methodname: string;
  args: Record<string, unknown>;
}

export function isAllowedFunction(name: string): name is AllowedFunction {
  return (ALLOWED_FUNCTIONS as readonly string[]).includes(name);
}
