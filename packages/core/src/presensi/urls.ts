// Attendance pages Sulo may read (mod_attendance, student view). Read-only:
// never the "take" page, sessions.php, a status or remarks form, or anything
// with a sesskey. Pure.

export const ATTENDANCE_PATH = '/mod/attendance/view.php';

/** "All courses" tab: the recap of every course in one GET. */
export const recapPath = (cmid: number) => `${ATTENDANCE_PATH}?id=${cmid}&mode=1`;

/**
 * One course's sessions, filter "All" (view=5, ATT_VIEW_ALL), as the "All"
 * button on the course's attendance page links it.
 */
export const detailPath = (cmid: number) => `${ATTENDANCE_PATH}?id=${cmid}&view=5`;

/**
 * The cmid of an attendance page the user opened (content script): only
 * https://sikola-v2.unhas.ac.id/mod/attendance/view.php?id={number}.
 */
export function attendanceCmidFromUrl(href: string): number | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.origin !== 'https://sikola-v2.unhas.ac.id' || url.pathname !== ATTENDANCE_PATH) return null;
  const id = url.searchParams.get('id');
  return id !== null && /^\d{1,10}$/.test(id) && Number(id) > 0 ? Number(id) : null;
}

const ALLOWED_PARAMS = new Set(['id', 'mode', 'view']);
const FORBIDDEN = /take|sessions\.php|submit|sesskey|status|remarks|self|password/i;

/**
 * True only for mod/attendance/view.php with nothing but id, mode and view
 * (numbers). Everything that could mark attendance or change data fails.
 */
export function isReadOnlyAttendanceUrl(pathAndQuery: string): boolean {
  let url: URL;
  try {
    url = new URL(pathAndQuery, 'https://sikola.invalid');
  } catch {
    return false;
  }
  if (url.pathname !== ATTENDANCE_PATH || FORBIDDEN.test(pathAndQuery)) return false;
  for (const [key, value] of url.searchParams) if (!ALLOWED_PARAMS.has(key) || !/^\d+$/.test(value)) return false;
  return url.searchParams.has('id');
}
