// Account and setup status, and which screen the popup and the setup page
// show. Pure; the table is in docs/UI.md ("Keputusan layar").

import type { M2StepId } from '../onboarding/flow';
import type { SessionState } from '../types';
import type { AccountPending } from './pending';

export type AccountStatus = 'none' | 'connected' | 'expired' | 'mismatch';

/** A pending account is only ever stored for a different userid (run-sync.ts). */
export function accountStatus(input: { hasUser: boolean; session: SessionState; pending: AccountPending | null }): AccountStatus {
  if (!input.hasUser) return 'none';
  if (input.pending !== null) return 'mismatch';
  return input.session === 'EXPIRED' ? 'expired' : 'connected';
}

export type SetupStatus = 'not_started' | 'in_progress' | 'done';

/** Per account: done once the courses were confirmed; in progress once SIKOLA is connected. */
export function setupStatus(input: { hasUser: boolean; completedAt: number | null }): SetupStatus {
  if (input.completedAt !== null) return 'done';
  return input.hasUser ? 'in_progress' : 'not_started';
}

export type PopupScreen = 'setup' | 'mismatch' | 'main';

/**
 * The popup: another account always comes first (its data stays hidden);
 * then setup until it is done; then the task list (an expired session is a
 * status line on the list, not a screen of its own).
 */
export function decidePopupScreen(account: AccountStatus, setup: SetupStatus): PopupScreen {
  if (account === 'mismatch') return 'mismatch';
  if (account === 'none' || setup !== 'done') return 'setup';
  return 'main';
}

export type OnboardingMode = 'first-run' | 'manage-courses' | 'switch-account' | 'whats-new' | 'mismatch';

export interface OnboardingModeInput {
  hash: string;
  account: AccountStatus;
  setup: SetupStatus;
  hasCourses: boolean;
  /** Something new to show, or the privacy notice changed since it was read. */
  whatsNew: boolean;
}

/** The setup page: one flow, four modes, plus the "another account" screen. */
export function decideOnboardingMode(input: OnboardingModeInput): OnboardingMode {
  if (input.account === 'mismatch') return 'mismatch';
  if (input.hash === '#switch-account') return 'switch-account';
  if (input.setup !== 'done') return 'first-run';
  if (input.whatsNew && input.hash !== '#courses') return 'whats-new';
  if (input.hasCourses) return 'manage-courses';
  // Setup done but no course list stored (cleared): the connect step fetches it.
  return 'switch-account';
}

export const SETUP_PROGRESS_KEY = 'global:setupProgress';

/**
 * Where first-run resumes: the last step reached, but never past what the
 * stored data allows (the course step needs a course list, the done step a
 * finished setup), and always the notice first when it was not read.
 */
export function resumeStep(input: { saved: M2StepId | null; noticeRead: boolean; hasUser: boolean; hasCourses: boolean }): M2StepId {
  if (!input.noticeRead || input.saved === null || input.saved === 'intro') return 'intro';
  if (!input.hasUser || !input.hasCourses) return 'connect';
  return 'courses';
}
