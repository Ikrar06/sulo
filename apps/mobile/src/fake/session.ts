// The browser stand-in for SuloSession (pnpm mobile:web, tests). It answers
// from synthetic fixtures; nothing leaves the browser.

import type { BatchReply, PageReply, SessionStatus, SuloSessionPlugin } from '../session';
import { FAKE_DATA, FAKE_PAGES } from './fixtures';

let status: SessionStatus = 'none';
/** Screenshot switches: ?session=expired signs in to an ended session; ?signin=cancel|offline closes the sign-in page; ?lock=wait, ?lock=fail or ?lock=nolock answers the app lock so. */
const param = (name: string) => (typeof location === 'undefined' ? null : new URLSearchParams(location.search).get(name));

export function fakeSession(): SuloSessionPlugin {
  return {
    login: async () => {
      // ?signin=cancel or ?signin=offline: the sign-in page closed without signing in (screenshots).
      const signin = param('signin');
      if (signin === 'cancel') return { status: 'cancelled' };
      if (signin === 'offline') return { status: 'offline' };
      status = param('session') === 'expired' ? 'expired' : 'connected';
      return { status: 'connected' };
    },
    status: async () => ({ status }),
    haptic: async () => undefined,
    discardSession: async () => ((status = 'expired'), { status }),
    watchReset: async () => undefined,
    request: async ({ body }): Promise<BatchReply> => {
      if (status !== 'connected') return { sessionStatus: status };
      const calls = JSON.parse(body) as { methodname: string }[];
      const results = calls.map((c) => ({ error: false, data: FAKE_DATA[c.methodname] ?? {} }));
      return { httpStatus: 200, body: JSON.stringify(results), sessionStatus: status };
    },
    page: async ({ path }): Promise<PageReply> => {
      if (status !== 'connected') return { sessionStatus: status };
      const html = path.includes('mode=1') ? FAKE_PAGES.recap : path.includes('view=5') ? FAKE_PAGES.detail : null;
      return html === null ? { httpStatus: 404, html: '', sessionStatus: status } : { httpStatus: 200, html, sessionStatus: status };
    },
    logout: async () => ((status = 'none'), { status: 'none' }),
    lockAvailable: async () => ({ available: true }),
    openAppSettings: async () => undefined,
    watchApply: async () => undefined,
    watchTake: async () => ({ answers: [], fullSync: false }),
    watchStatus: async () => ({ timings: '[]', sessionEnds: '[]', plannedAt: 0, queued: 0 }),
    watchTakeOpen: async () => ({ id: null }),
    watchRunNow: async () => undefined,
    watchSimulate: async () => ({ status: 'web', changes: 0, notices: 0 }),
    unlock: async () => (param('lock') === 'wait' ? new Promise<never>(() => undefined) : param('lock') === 'nolock' ? { unlocked: false, reason: 'no_device_lock' } : param('lock') === 'fail' ? { unlocked: false } : { unlocked: true }),
  };
}

/** Tests: start from a given state. */
export function setFakeStatus(next: SessionStatus) {
  status = next;
}
