// "Yang baru di Sulo". Someone who finished onboarding never repeats it. When a
// big feature arrives, the notice version is bumped and they see one short
// screen with the entries newer than the version they last read (stored under
// NOTICE_KEY). M2 ships the mechanism only: the list is empty.

export interface WhatsNewEntry {
  /** The notice version that introduced this entry. */
  noticeVersion: number;
  title: string;
  body: string;
}

export const WHATS_NEW: readonly WhatsNewEntry[] = [];

export function pendingWhatsNew(entries: readonly WhatsNewEntry[], readVersion: number, completed: boolean): WhatsNewEntry[] {
  if (!completed) return [];
  return entries.filter((e) => e.noticeVersion > readVersion);
}
