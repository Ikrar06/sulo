// Loads the popup input from storage. Pure: the store is injected.

import { isSyncRunning } from '../sync/lock';
import { readBudget } from '../moodle/budget';
import { DAILY_BUDGET } from '../moodle/limits';
import { readSession } from '../moodle/session';
import { readRemoteConfig } from '../remote/remote-config';
import { currentUser, readAllUser, readSyncStatus } from '../storage';
import { readPending } from '../account/pending';
import { CALENDAR_HIGHLIGHT_KEY, type CalendarHighlight } from '../calendar/highlight-key';
import type { Clock, KeyValueStore } from '../types';
import type { PopupInput } from './popup-view';

export async function loadPopupInput(store: KeyValueStore, clock: Clock, timeZone: string): Promise<PopupInput> {
  const userId = await currentUser(store);
  const [user, session, syncStatus, remoteConfig, budget, syncing, accountPending, calendarHighlight] = await Promise.all([
    userId === null ? Promise.resolve(null) : readAllUser(store, userId),
    readSession(store),
    readSyncStatus(store),
    readRemoteConfig(store),
    readBudget(store, clock),
    isSyncRunning(store, clock.now()),
    readPending(store),
    store.get<CalendarHighlight | null>(CALENDAR_HIGHLIGHT_KEY),
  ]);
  return {
    user,
    session: session.state,
    syncStatus,
    syncing,
    remoteConfig,
    budget,
    budgetLimit: DAILY_BUDGET,
    now: clock.now(),
    timeZone,
    accountPending,
    calendarHighlight: calendarHighlight ?? null,
  };
}
