// SuloSession, the app's own native plugin (apps/mobile/android, Kotlin).
// JavaScript only ever gets statuses and codes: the SIKOLA cookie and the
// sesskey never cross into this side (CLAUDE.md, mobile rule 2).

import { registerPlugin } from '@capacitor/core';

export type SessionStatus = 'none' | 'connected' | 'expired';

/** One try at SIKOLA during the spike: codes only. */
export interface ProbeAttempt {
  myHttpStatus?: number;
  myRedirectedToLogin?: boolean;
  sesskeyFound?: boolean;
  postHttpStatus?: number;
  accepted?: boolean;
  errorcode?: string | null;
  timeRemaining?: number | null;
  failure?: string;
}

export interface ProbeResult {
  status: SessionStatus;
  userAgent?: string;
  cookieNames?: string;
  landedPath?: string;
  sulo?: ProbeAttempt;
  /** Only when the Sulo User-Agent was refused. */
  webview?: ProbeAttempt;
}

export interface SuloSessionPlugin {
  login(): Promise<{ status: 'connected' | 'cancelled' }>;
  status(): Promise<{ status: SessionStatus }>;
  probe(): Promise<ProbeResult>;
  logout(): Promise<{ status: 'none' }>;
}

/** pnpm mobile:web: a stand-in with fixed answers; no request leaves the browser. */
function fakeSession(): SuloSessionPlugin {
  let status: SessionStatus = 'none';
  return {
    login: async () => ((status = 'connected'), { status: 'connected' }),
    status: async () => ({ status }),
    probe: async () =>
      status === 'none'
        ? { status }
        : {
            status,
            userAgent: 'Sulo/0.2.0 (Android)',
            cookieNames: 'MoodleSession',
            landedPath: '/my/',
            sulo: { myHttpStatus: 200, myRedirectedToLogin: false, sesskeyFound: true, postHttpStatus: 200, accepted: true, errorcode: null, timeRemaining: 7140 },
          },
    logout: async () => ((status = 'none'), { status: 'none' }),
  };
}

export const SuloSession = registerPlugin<SuloSessionPlugin>('SuloSession', { web: fakeSession });
