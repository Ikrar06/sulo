// SuloSession, the app's own native plugin (apps/mobile/android, Kotlin).
// JavaScript only ever gets statuses and Moodle's JSON: the SIKOLA cookie
// and the sesskey never cross into this side (CLAUDE.md, mobile rule 2).

import { registerPlugin } from '@capacitor/core';

export type SessionStatus = 'none' | 'connected' | 'expired';

export interface BatchReply {
  /** Present when the request reached SIKOLA. */
  httpStatus?: number;
  /** Moodle's JSON, as text. */
  body?: string;
  /** The session after this request (expired when SIKOLA asked for a login). */
  sessionStatus: SessionStatus;
  /** The kind of network failure (e.g. "UnknownHostException"), never a message. */
  networkError?: string;
  /** No sesskey yet and the request was not started by the user. */
  needsUser?: boolean;
}

export interface SuloSessionPlugin {
  /** SIKOLA's own login page; resolves once signed in or closed. */
  login(): Promise<{ status: 'connected' | 'cancelled' }>;
  status(): Promise<{ status: SessionStatus }>;
  /** One batch to service.php. userInitiated decides nosessionupdate (native). */
  request(options: { body: string; userInitiated: boolean }): Promise<BatchReply>;
  /** Cookies, web storage, the encrypted session and its Keystore key. */
  logout(): Promise<{ status: 'none' }>;
  lockAvailable(): Promise<{ available: boolean }>;
  /** Never unlocked by default: with no screen lock on the phone, reason is "no_device_lock". */
  unlock(): Promise<{ unlocked: boolean; reason?: 'no_device_lock' }>;
}

export const SuloSession = registerPlugin<SuloSessionPlugin>('SuloSession', {
  // pnpm mobile:web and Vitest: a stand-in with fixtures, no request.
  web: () => import('./fake/session').then((m) => m.fakeSession()),
});
