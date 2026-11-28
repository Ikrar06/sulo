// "Perbarui dari NEOSIA" in the extension (1.1.0): from the user's click a
// NEOSIA page opens in a new tab; once its data came in (a capture from that
// very tab), the tab closes by itself after a short wait. Without data in 30
// seconds (NEOSIA asked to sign in, or the page is slow) the tab stays as it
// is and Sulo stops watching it. Pure: the tab API is injected; the one
// tracked tab lives in session storage, never in a variable.

import type { KeyValueStore, UnixSeconds } from '../types';

export const REFRESH_TAB_KEY = 'neosia:refreshTab';
export const REFRESH_WATCH_SEC = 30;
export const REFRESH_SETTLE_MS = 2500;

export interface RefreshTab {
  tabId: number;
  openedAt: UnixSeconds;
}

export async function startRefresh(session: KeyValueStore, open: () => Promise<number | undefined>, now: UnixSeconds): Promise<boolean> {
  const tabId = await open();
  if (tabId === undefined) return false;
  await session.set<RefreshTab>(REFRESH_TAB_KEY, { tabId, openedAt: now });
  return true;
}

/** A capture arrived from `tabId`: true when it is the tracked refresh tab, still within its time (the caller then closes it). */
export async function captureFrom(session: KeyValueStore, tabId: number | undefined, now: UnixSeconds): Promise<boolean> {
  const tracked = await session.get<RefreshTab>(REFRESH_TAB_KEY);
  if (!tracked || tabId === undefined) return false;
  if (now - tracked.openedAt > REFRESH_WATCH_SEC) {
    await session.remove(REFRESH_TAB_KEY);
    return false;
  }
  if (tracked.tabId !== tabId) return false;
  await session.remove(REFRESH_TAB_KEY);
  return true;
}
