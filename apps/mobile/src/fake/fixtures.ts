// Synthetic SIKOLA answers for the browser stand-in (the extension's
// sanitized fixtures: no real account, name, student number or email).
import calendar from '../../../extension/fixtures/synthetic/calendar-action-events.normal.json';
import state from '../../../extension/fixtures/synthetic/courseformat-state.normal.json';
import courses from '../../../extension/fixtures/synthetic/enrolled-courses.normal.json';
import notifications from '../../../extension/fixtures/synthetic/popup-notifications.normal.json';
import recapPage from '../../../extension/fixtures/synthetic/pages/attendance-all-courses.html?raw';
import detailPage from '../../../extension/fixtures/synthetic/pages/attendance-course-sessions.synthetic.html?raw';
import session from '../../../extension/fixtures/synthetic/session-time-remaining.normal.json';

export const FAKE_DATA: Record<string, unknown> = {
  core_session_time_remaining: session,
  core_calendar_get_action_events_by_timesort: calendar,
  core_courseformat_get_state: state,
  message_popup_get_popup_notifications: notifications,
  core_course_get_enrolled_courses_by_timeline_classification: courses,
};

/** Attendance pages (sanitized; their synthetic account is user 1, like the session fixture). */
export const FAKE_PAGES = { recap: recapPage, detail: detailPage };
