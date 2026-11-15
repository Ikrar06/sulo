// Loads the popup input from storage. Pure: the store is injected.

import { readBudget } from '../moodle/budget';
import { DAILY_BUDGET } from '../moodle/limits';
import { readSession } from '../moodle/session';
import { readRemoteConfig } from '../remote-config';
import { currentUser, readAllUser, readSyncStatus } from '../storage';
import type { Clock, KeyValueStore } from '../types';
import type { PopupInput } from './popup-view';

export async function loadPopupInput(store: KeyValueStore, clock: Clock, timeZone: string): Promise<PopupInput> {
  const userId = await currentUser(store);
  const [user, session, syncStatus, remoteConfig, budget] = await Promise.all([
    userId === null ? Promise.resolve(null) : readAllUser(store, userId),
    readSession(store),
    readSyncStatus(store),
    readRemoteConfig(store),
    readBudget(store, clock),
  ]);
  return {
    user,
    session: session.state,
    syncStatus,
    remoteConfig,
    budget,
    budgetLimit: DAILY_BUDGET,
    now: clock.now(),
    timeZone,
  };
}
