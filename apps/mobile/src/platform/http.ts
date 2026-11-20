import { FRESH_CONNECTION_HEADER } from '@sulo/core/moodle/client';
import { SIKOLA_ORIGIN } from '@sulo/core/moodle/limits';
import type { HttpClient } from '@sulo/core/platform';
import { SuloSession } from '../session';

// Requests to SIKOLA go through SuloSession: the native side adds the
// session cookie, the real sesskey and the Sulo User-Agent, and decides
// nosessionupdate from userInitiated. The core client still does
// everything else (allowlist, budget, queue, backoff, parsing).

/** The core client needs a sesskey to build its URL; the real one is inserted natively. */
export const NATIVE_SESSKEY = 'nativeSesskey';

/** The only HTML page JavaScript may ask for (native allowlist: id, mode, view). */
const ATTENDANCE_PAGE = '/mod/attendance/view.php';

/** What a non-login redirect of the attendance page becomes: an http_error for that course only. */
export const COURSE_PAGE_CLOSED = 403;

/** An attendance page, natively fetched and stripped (no head, scripts, forms or sesskey). */
async function page(path: string, userInitiated: boolean): Promise<Response> {
  const reply = await SuloSession.page({ path, userInitiated });
  if (reply.deferred) return closing();
  if (reply.networkError) throw new TypeError('network');
  // No usable session: SIKOLA's own answer would be a redirect to its login.
  if (reply.httpStatus === undefined || reply.html === undefined) return toLogin();
  if (reply.httpStatus >= 300 && reply.httpStatus < 400) {
    // To SIKOLA's login: core asks once more before anything ends. Anywhere
    // else: this course's page can't be opened (hidden, enrolment ended).
    return reply.toLogin ? toLogin() : new Response(null, { status: COURSE_PAGE_CLOSED });
  }
  return new Response(reply.html, { status: reply.httpStatus, headers: { 'Content-Type': 'text/html' } });
}

/**
 * The app was closing, so nothing was sent (the sync runs on the next open).
 * A 409 reads as that one request's failure: no backoff (only 429 and 5xx
 * count), no session change.
 */
export const DEFERRED_STATUS = 409;
const closing = () => new Response(null, { status: DEFERRED_STATUS });

const toLogin = () => new Response(null, { status: 303, headers: { Location: `${SIKOLA_ORIGIN}/login/index.php` } });

const LOGIN_REQUIRED = JSON.stringify([{ error: true, exception: { errorcode: 'servicerequireslogin', message: '' } }]);

export function createSessionHttp(userInitiated: boolean, onBatch?: (body: string) => void): HttpClient {
  return {
    async request(input, init) {
      const url = new URL(input);
      if (url.origin === SIKOLA_ORIGIN && url.pathname === ATTENDANCE_PAGE && (init?.method ?? 'GET') === 'GET') return page(`${url.pathname}${url.search}`, userInitiated);
      if (url.origin !== SIKOLA_ORIGIN || url.pathname !== '/lib/ajax/service.php' || init?.method !== 'POST' || typeof init.body !== 'string') {
        // Anything else is refused here and again natively (SikolaPage, SikolaRequest).
        return new Response('', { status: 404 });
      }
      const fresh = new Headers(init.headers).get(FRESH_CONNECTION_HEADER) === '1';
      const reply = await SuloSession.request({ body: init.body, userInitiated, ...(fresh ? { fresh: true } : {}) });
      if (reply.deferred) return closing();
      if (reply.networkError) throw new TypeError('network');
      // No usable session: answer like Moodle does, so core marks it expired.
      if (reply.httpStatus === undefined || reply.body === undefined) {
        return new Response(reply.needsUser ? JSON.stringify({ errorcode: 'invalidsesskey' }) : LOGIN_REQUIRED, { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      // SIKOLA sent us to its login (the batch, or /my/ for a sesskey): core asks once more.
      if (reply.httpStatus >= 300 && reply.httpStatus < 400) return toLogin();
      onBatch?.(reply.body);
      return new Response(reply.body, { status: reply.httpStatus, headers: { 'Content-Type': 'application/json' } });
    },
  };
}
