// The "Hubungkan NEOSIA" card on the overview while the module is off
// (M7.1). "Nanti saja" hides it for 30 days; it comes back on its own from
// 14 days before the next KRS window in the academic calendar. Pure.

import { addDays } from '../calendar/dates.ts';
import type { KeyValueStore, UnixSeconds } from '../types';

export const NEOSIA_INVITE_KEY = 'global:neosiaInvite';
export const INVITE_SNOOZE_DAYS = 30;
export const INVITE_KRS_LEAD_DAYS = 14;

export interface InviteState {
  dismissedAt: UnixSeconds | null;
  /** The local day of the dismissal (YYYY-MM-DD). */
  dismissedDay: string | null;
}

export async function readInvite(store: KeyValueStore): Promise<InviteState> {
  const raw = await store.get<InviteState>(NEOSIA_INVITE_KEY);
  return { dismissedAt: typeof raw?.dismissedAt === 'number' ? raw.dismissedAt : null, dismissedDay: typeof raw?.dismissedDay === 'string' ? raw.dismissedDay : null };
}

export async function dismissInvite(store: KeyValueStore, now: UnixSeconds, today: string): Promise<void> {
  await store.set<InviteState>(NEOSIA_INVITE_KEY, { dismissedAt: now, dismissedDay: today });
}

/**
 * Shown when never dismissed, 30 days after "Nanti saja", or when a KRS
 * window from the calendar starts within 14 days (or is open) and the
 * dismissal came before that lead time began.
 */
export function showInvite(input: { moduleOn: boolean; dismissedAt: UnixSeconds | null; now: UnixSeconds; today: string; krsWindows: readonly { mulai: string; selesai: string | null }[]; dismissedDay: string | null }): boolean {
  if (input.moduleOn) return false;
  if (input.dismissedAt === null) return true;
  if (input.now - input.dismissedAt >= INVITE_SNOOZE_DAYS * 86_400) return true;
  return input.krsWindows.some((w) => {
    const leadStart = addDays(w.mulai, -INVITE_KRS_LEAD_DAYS);
    const end = w.selesai ?? w.mulai;
    return input.today >= leadStart && input.today <= end && (input.dismissedDay === null || input.dismissedDay < leadStart);
  });
}
