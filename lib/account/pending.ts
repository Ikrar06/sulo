// Another SIKOLA account signed in on this browser. Sulo does not wipe the
// previous account at once: it hides that account's data, stops syncing and
// reminders, and asks. Data is deleted only when the user confirms ("Pakai
// akun ini") or uses "Hapus semua data" (CLAUDE.md rule 10). Pure.

import { MISMATCH_CHECK_GAP_MIN } from '../moodle/limits';
import type { KeyValueStore, UnixSeconds, UserId } from '../types';

export const ACCOUNT_PENDING_KEY = 'global:accountPending';

export interface AccountPending {
  /** The account now signed in on SIKOLA (not yet confirmed). */
  userId: UserId;
  detectedAt: UnixSeconds;
  /** Last session-only check, for the 10-minute gap. */
  lastCheckAt: UnixSeconds;
  /** "Nanti, aku akan masuk dengan akun sebelumnya": the popup keeps a short note. */
  deferredAt: UnixSeconds | null;
}

export async function readPending(store: KeyValueStore): Promise<AccountPending | null> {
  return (await store.get<AccountPending>(ACCOUNT_PENDING_KEY)) ?? null;
}

export function newPending(userId: UserId, now: UnixSeconds): AccountPending {
  return { userId, detectedAt: now, lastCheckAt: now, deferredAt: null };
}

/** While mismatched, only "Perbarui" and a new sesskey may check, the latter once per 10 minutes. */
export function mayCheckWhilePending(pending: AccountPending, trigger: string, now: UnixSeconds): boolean {
  if (trigger === 'manual') return true;
  if (trigger === 'sesskey') return now - pending.lastCheckAt >= MISMATCH_CHECK_GAP_MIN * 60;
  return false;
}

export type CheckResult =
  /** The previous account is back: pending cleared, normal sync next cycle. */
  | { kind: 'restored'; next: null }
  /** Still the same other account: nothing new to say. */
  | { kind: 'same'; next: AccountPending }
  /** A third account: pending now points at it. */
  | { kind: 'third'; next: AccountPending };

/** What a session-only check during a mismatch means. */
export function resolveCheck(current: UserId, pending: AccountPending, seen: UserId, now: UnixSeconds): CheckResult {
  if (seen === current) return { kind: 'restored', next: null };
  if (seen === pending.userId) return { kind: 'same', next: { ...pending, lastCheckAt: now } };
  return { kind: 'third', next: newPending(seen, now) };
}
