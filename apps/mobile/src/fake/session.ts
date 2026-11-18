// The browser stand-in for SuloSession (pnpm mobile:web, tests). It answers
// from synthetic fixtures; nothing leaves the browser.

import type { BatchReply, SessionStatus, SuloSessionPlugin } from '../session';
import { FAKE_DATA } from './fixtures';

let status: SessionStatus = 'none';

export function fakeSession(): SuloSessionPlugin {
  return {
    login: async () => ((status = 'connected'), { status: 'connected' }),
    status: async () => ({ status }),
    request: async ({ body }): Promise<BatchReply> => {
      if (status !== 'connected') return { sessionStatus: status };
      const calls = JSON.parse(body) as { methodname: string }[];
      const results = calls.map((c) => ({ error: false, data: FAKE_DATA[c.methodname] ?? {} }));
      return { httpStatus: 200, body: JSON.stringify(results), sessionStatus: status };
    },
    logout: async () => ((status = 'none'), { status: 'none' }),
    lockAvailable: async () => ({ available: true }),
    unlock: async () => ({ unlocked: true }),
  };
}

/** Tests: start from a given state. */
export function setFakeStatus(next: SessionStatus) {
  status = next;
}
