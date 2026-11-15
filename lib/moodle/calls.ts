// Allowlists for everything the client may request. Read-only only.
// The client refuses any function or page not listed here.

import type { CourseId, UnixSeconds, UserId } from '../types';
import {
  CALENDAR_LIMIT,
  CALENDAR_LOOKAHEAD_DAYS,
  CALENDAR_LOOKBACK_DAYS,
  NOTIFICATIONS_LIMIT,
} from './limits';

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

/** HTML pages that may be fetched, only on user request. Matched by exact pathname. */
export const ALLOWED_PAGES = [
  '/my/',
  '/mod/attendance/view.php',
  '/mod/assign/view.php',
  '/grade/report/overview/index.php',
] as const;

export function isAllowedPage(pathname: string): boolean {
  return (ALLOWED_PAGES as readonly string[]).includes(pathname);
}

const DAY = 86_400;

// Builders keep argument shapes in one place.
export const calls = {
  sessionTimeRemaining: (): MoodleCall => ({ methodname: 'core_session_time_remaining', args: {} }),

  calendarActionEvents: (now: UnixSeconds): MoodleCall => ({
    methodname: 'core_calendar_get_action_events_by_timesort',
    args: {
      timesortfrom: now - CALENDAR_LOOKBACK_DAYS * DAY,
      timesortto: now + CALENDAR_LOOKAHEAD_DAYS * DAY,
      limitnum: CALENDAR_LIMIT,
    },
  }),

  courseformatState: (courseid: CourseId): MoodleCall => ({
    methodname: 'core_courseformat_get_state',
    args: { courseid },
  }),

  popupNotifications: (useridto: UserId): MoodleCall => ({
    methodname: 'message_popup_get_popup_notifications',
    args: { useridto, limit: NOTIFICATIONS_LIMIT, offset: 0 },
  }),

  enrolledCourses: (): MoodleCall => ({
    methodname: 'core_course_get_enrolled_courses_by_timeline_classification',
    args: { classification: 'all', limit: 0, offset: 0 },
  }),
} as const;
