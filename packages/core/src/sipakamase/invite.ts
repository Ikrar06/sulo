// The "Hubungkan Sipakamase" card on the overview while the module is off (1.1.0, owner 27 Nov 2026: connecting
// should not mean finding it in Pengaturan). Sipakamase's numbers only show in the MKPK card, so the card is
// offered only where that card shows (NEOSIA on, MKPK applies, a load other than "none"): connecting elsewhere
// would show nothing. It comes after NEOSIA's own invite and checklist, never beside them, since the MKPK card
// needs NEOSIA first. "Nanti saja" hides it for 30 days; the MKPK card keeps its quiet link meanwhile. Connecting
// still goes through the consent (hard rule 17): the card only opens it. Pure, but for the store helpers.

import type { KeyValueStore, UnixSeconds } from '../types';

export const SIPAKAMASE_INVITE_KEY = 'global:sipakamaseInvite';
export const SIPAKAMASE_INVITE_SNOOZE_DAYS = 30;

export interface SipakamaseInviteState {
  dismissedAt: UnixSeconds | null;
}

export async function readSipakamaseInvite(store: KeyValueStore): Promise<SipakamaseInviteState> {
  const raw = await store.get<SipakamaseInviteState>(SIPAKAMASE_INVITE_KEY);
  return { dismissedAt: typeof raw?.dismissedAt === 'number' && Number.isFinite(raw.dismissedAt) ? raw.dismissedAt : null };
}

export async function dismissSipakamaseInvite(store: KeyValueStore, now: UnixSeconds): Promise<void> {
  await store.set<SipakamaseInviteState>(SIPAKAMASE_INVITE_KEY, { dismissedAt: now });
}

/**
 * Shown while Sipakamase is off, the MKPK card shows and NEOSIA's checklist is done (`neosiaSetupDone`: its card
 * has gone), unless "Nanti saja" was chosen in the last 30 days.
 */
export function showSipakamaseInvite(input: { moduleOn: boolean; mkpkCardShown: boolean; neosiaSetupDone: boolean; dismissedAt: UnixSeconds | null; now: UnixSeconds }): boolean {
  if (input.moduleOn || !input.mkpkCardShown || !input.neosiaSetupDone) return false;
  return input.dismissedAt === null || input.now - input.dismissedAt >= SIPAKAMASE_INVITE_SNOOZE_DAYS * 86_400;
}

/** Where the MKPK card shows (packages/ui/src/dashboard/MkpkCard.tsx, apps/mobile/src/screens/neosia/MkpkCard.tsx). */
export function mkpkCardShown(input: { neosiaOn: boolean; applies: boolean; load: 20 | 10 | 'none' | null }): boolean {
  return input.neosiaOn && input.applies && input.load !== 'none';
}
