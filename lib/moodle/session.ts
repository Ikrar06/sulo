import type { Clock, KeyValueStore, SessionInfo, SessionState, UserId } from '../types';

export const SESSION_KEY = 'global:session';

const UNKNOWN: SessionInfo = { state: 'UNKNOWN', userId: null, checkedAt: 0 };

export async function readSession(store: KeyValueStore): Promise<SessionInfo> {
  return (await store.get<SessionInfo>(SESSION_KEY)) ?? UNKNOWN;
}

export async function writeSession(
  store: KeyValueStore,
  clock: Clock,
  state: SessionState,
  userId?: UserId | null,
): Promise<SessionInfo> {
  const prev = await readSession(store);
  const next: SessionInfo = {
    state,
    userId: userId === undefined ? prev.userId : userId,
    checkedAt: clock.now(),
  };
  await store.set(SESSION_KEY, next);
  return next;
}

/**
 * A fresh sesskey from the content script means the user is logged in again.
 * Leaves EXPIRED so the client stops refusing; the next call confirms OK.
 */
export async function onSesskeyReceived(store: KeyValueStore, clock: Clock): Promise<void> {
  const current = await readSession(store);
  if (current.state === 'EXPIRED') await writeSession(store, clock, 'UNKNOWN');
}
