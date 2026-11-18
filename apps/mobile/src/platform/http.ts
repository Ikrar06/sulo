import { SIKOLA_ORIGIN } from '@sulo/core/moodle/limits';
import type { HttpClient } from '@sulo/core/platform';
import { SuloSession } from '../session';

// Requests to SIKOLA go through SuloSession: the native side adds the
// session cookie, the real sesskey and the Sulo User-Agent, and decides
// nosessionupdate from userInitiated. The core client still does
// everything else (allowlist, budget, queue, backoff, parsing).

/** The core client needs a sesskey to build its URL; the real one is inserted natively. */
export const NATIVE_SESSKEY = 'nativeSesskey';

const LOGIN_REQUIRED = JSON.stringify([{ error: true, exception: { errorcode: 'servicerequireslogin', message: '' } }]);

export function createSessionHttp(userInitiated: boolean, onBatch?: (body: string) => void): HttpClient {
  return {
    async request(input, init) {
      const url = new URL(input);
      if (url.origin !== SIKOLA_ORIGIN || url.pathname !== '/lib/ajax/service.php' || init?.method !== 'POST' || typeof init.body !== 'string') {
        // Pages (HTML) are not read on mobile in M8b.
        return new Response('', { status: 404 });
      }
      const reply = await SuloSession.request({ body: init.body, userInitiated });
      if (reply.networkError) throw new TypeError('network');
      // No usable session: answer like Moodle does, so core marks it expired.
      if (reply.httpStatus === undefined || reply.body === undefined) {
        return new Response(reply.needsUser ? JSON.stringify({ errorcode: 'invalidsesskey' }) : LOGIN_REQUIRED, { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      onBatch?.(reply.body);
      return new Response(reply.body, { status: reply.httpStatus, headers: { 'Content-Type': 'application/json' } });
    },
  };
}
