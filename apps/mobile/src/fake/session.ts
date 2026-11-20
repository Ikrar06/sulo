// The browser stand-in for SuloSession (pnpm mobile:web, tests). It answers
// from synthetic fixtures; nothing leaves the browser.

import type { BatchReply, PageReply, SessionStatus, SuloSessionPlugin } from '../session';
import { FAKE_DATA, FAKE_PAGES } from './fixtures';

/** Screenshot switches: ?session=connected starts signed in (a cold open with data, scripts/perf-measure.mjs); ?session=expired signs in to an ended session; ?session=ended opens on an ended session over the stored data (signing in again then connects); ?signin=cancel|offline closes the sign-in page; ?lock=wait, ?lock=fail or ?lock=nolock answers the app lock so. */
const param = (name: string) => (typeof location === 'undefined' ? null : new URLSearchParams(location.search).get(name));
// The measuring APK opens cold after signing in once: the stand-in remembers it (this browser or app only).
const FAKE_SIGNED_IN = 'sulo:fake:signedIn';
const remembered = () => { try { return localStorage.getItem(FAKE_SIGNED_IN) === '1'; } catch { return false; } };
let status: SessionStatus = param('session') === 'ended' ? 'expired' : param('session') === 'connected' || remembered() ? 'connected' : 'none';

export function fakeSession(): SuloSessionPlugin {
  return {
    login: async () => {
      // ?signin=cancel or ?signin=offline: the sign-in page closed without signing in (screenshots).
      const signin = param('signin');
      if (signin === 'cancel') return { status: 'cancelled' };
      if (signin === 'offline') return { status: 'offline' };
      status = param('session') === 'expired' ? 'expired' : 'connected';
      try { localStorage.setItem(FAKE_SIGNED_IN, '1'); } catch { /* private mode: only this page load */ }
      return { status: 'connected' };
    },
    status: async () => ({ status }),
    diagLog: async () => ({ events: [] }),
    endSession: async () => ((status = 'expired'), { status }),
    suspect: async () => ({ suspect: false }),
    note: async () => undefined,
    ready: async () => undefined,
    devTestBudget: async () => undefined,
    haptic: async () => undefined,
    secure: async () => undefined,
    // ?device=low: a 2 GB, 4-core phone with an old WebView (the lite tier in the browser).
    deviceInfo: async () => (param('device') === 'low' ? { lowRamDevice: true, totalRamMb: 1900, cpuCores: 4, webView: '83.0.4103.106' } : { lowRamDevice: false, totalRamMb: 7600, cpuCores: 8, webView: navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? 'web' }),
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
    logout: async () => {
      status = 'none';
      try { localStorage.removeItem(FAKE_SIGNED_IN); } catch { /* nothing kept */ }
      return { status: 'none' };
    },
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
