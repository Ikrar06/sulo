// How a failed core_courseformat_get_state is treated, by Moodle error code.
// One data table, easy to correct once real samples arrive. Unknown codes
// fall into "other".
//
// - access: this course is not reachable for this user (not enrolled,
//   hidden, no permission). Skipped for 24 hours, counts towards the
//   3-failures flag shown later in the course settings (M5a).
// - other: server or database trouble, or anything unknown. Counted in the
//   stats only; the course is retried at its next normal check (6 hours).
//   When every get_state in a batch fails this way while the session call
//   succeeded, SIKOLA itself is in trouble: one domain failure for backoff.

export type CourseErrorKind = 'access' | 'other';

export const ACCESS_ERRORCODES: readonly string[] = [
  'requireloginerror',
  'require_login_exception',
  'nopermissions',
  'notenrolled',
  'coursehidden',
  'courseisnotvisible',
  'invalidcourseid',
  'invalidrecord',
  'errorcoursecontextnotvalid',
  'notavailable',
];

export function courseErrorKind(errorcode: string): CourseErrorKind {
  return ACCESS_ERRORCODES.includes(errorcode) ? 'access' : 'other';
}
