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

export interface PageReply {
  httpStatus?: number;
  html?: string;
  sessionStatus: SessionStatus;
  networkError?: string;
}

export interface SuloSessionPlugin {
  /**
   * SIKOLA's own login page under a native bar (lock, host, close); resolves
   * once signed in or closed. "offline": closed while the page could not load.
   * The bar's words come from the app.
   */
  login(labels?: { close: string; offline: string; retry: string }): Promise<{ status: 'connected' | 'cancelled' | 'offline' }>;
  status(): Promise<{ status: SessionStatus }>;
  /** One batch to service.php. userInitiated decides nosessionupdate (native). */
  request(options: { body: string; userInitiated: boolean }): Promise<BatchReply>;
  /**
   * One allowlisted SIKOLA page (attendance only: id, mode, view), for
   * something the user started. The HTML comes stripped of its head,
   * scripts, forms and every sesskey (native SikolaPage.forJs).
   */
  page(options: { path: string; userInitiated: boolean }): Promise<PageReply>;
  /** Cookies, web storage, the encrypted session and its Keystore key. */
  logout(): Promise<{ status: 'none' }>;
  lockAvailable(): Promise<{ available: boolean }>;
  /** Never unlocked by default: with no screen lock on the phone, reason is "no_device_lock". */
  unlock(): Promise<{ unlocked: boolean; reason?: 'no_device_lock' }>;
  /** Android's settings page for this app (background use); asks for no permission. */
  openAppSettings(): Promise<void>;
  /** Background watching (M8c.3): the plan the native worker follows (watch-native.ts). */
  watchApply(options: { plan: string }): Promise<void>;
  /** The worker's queued answers, each a JSON string, handed over once. */
  watchTake(): Promise<{ answers: string[]; fullSync: boolean }>;
  /** Timings and session ends as JSON strings, the next planned check, the queue length. */
  watchStatus(): Promise<{ timings: string; sessionEnds: string; plannedAt: number; queued: number }>;
  /** A tapped background notification's id, once. */
  watchTakeOpen(): Promise<{ id: string | null }>;
  /** Debug build only (refused otherwise): one background check now, through the same work. */
  watchRunNow(): Promise<void>;
  /** Debug build only: a simulation without any request (task, due, three, quiet, expired). */
  watchSimulate(options: { kind: 'task' | 'due' | 'three' | 'quiet' | 'expired'; prefix: string }): Promise<{ status: string; changes: number; notices: number }>;
}

export const SuloSession = registerPlugin<SuloSessionPlugin>('SuloSession', {
  // pnpm mobile:web and Vitest: a stand-in with fixtures, no request. Left
  // out of the APK's bundle (the phone always has the native plugin).
  ...(__SULO_WEB_FAKE__ ? { web: () => import('./fake/session').then((m) => m.fakeSession()) } : {}),
});
