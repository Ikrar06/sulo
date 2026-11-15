// Typed storage with per-user keys. Data of one SIKOLA account never mixes
// with another: when the userid changes, the previous user's data is deleted
// before anything new is written. Pure: the KeyValueStore is injected.

import type { TaskStateMap } from './tasks/local-state';
import type { CourseId, CourseRecord, KeyValueStore, SyncOutcome, Task, UnixSeconds, UserId } from './types';

export const CURRENT_USER_KEY = 'global:currentUser';
export const NOTICE_KEY = 'global:notice';

/** Version of the privacy notice shown in onboarding step 1. Bump when its text changes. */
export const NOTICE_VERSION = 1;

export interface SyncMeta {
  lastSyncAt: UnixSeconds | null;
  lastAttemptAt: UnixSeconds | null;
  lastOutcome: SyncOutcome | null;
  lastCourseListAt: UnixSeconds | null;
}

export interface OnboardingState {
  completedAt: UnixSeconds | null;
  /** In-progress course ids at the user's last confirmation of active courses. */
  confirmedInProgress: CourseId[];
  /** In-progress courses that appeared since: the popup offers a review. */
  reviewSuggested: CourseId[];
}

export interface UserData {
  courses: CourseRecord[];
  tasks: Task[];
  taskState: TaskStateMap;
  sync: SyncMeta;
  onboarding: OnboardingState;
}

export const DEFAULTS: { [K in keyof UserData]: UserData[K] } = {
  courses: [],
  tasks: [],
  taskState: {},
  sync: { lastSyncAt: null, lastAttemptAt: null, lastOutcome: null, lastCourseListAt: null },
  onboarding: { completedAt: null, confirmedInProgress: [], reviewSuggested: [] },
};

export const userKey = (userId: UserId, name: keyof UserData) => `u:${userId}:${name}`;

export async function currentUser(store: KeyValueStore): Promise<UserId | null> {
  return (await store.get<UserId>(CURRENT_USER_KEY)) ?? null;
}

/**
 * Makes `userId` the current user. If another user's data exists, it is
 * deleted first. Returns true when a previous user's data was removed.
 */
export async function switchUser(store: KeyValueStore, userId: UserId): Promise<boolean> {
  const previous = await currentUser(store);
  if (previous === userId) return false;
  const staleKeys = (await store.keys('u:')).filter((k) => !k.startsWith(`u:${userId}:`));
  if (staleKeys.length > 0) await store.remove(staleKeys);
  await store.set(CURRENT_USER_KEY, userId);
  return previous !== null || staleKeys.length > 0;
}

export async function readUser<K extends keyof UserData>(store: KeyValueStore, userId: UserId, name: K): Promise<UserData[K]> {
  return (await store.get<UserData[K]>(userKey(userId, name))) ?? DEFAULTS[name];
}

export async function writeUser<K extends keyof UserData>(
  store: KeyValueStore,
  userId: UserId,
  name: K,
  value: UserData[K],
): Promise<void> {
  await store.set(userKey(userId, name), value);
}

/** Reads every user key at once, with defaults, for building views. */
export async function readAllUser(store: KeyValueStore, userId: UserId): Promise<UserData> {
  const entries = await Promise.all(
    (Object.keys(DEFAULTS) as (keyof UserData)[]).map(async (name) => [name, await readUser(store, userId, name)] as const),
  );
  return Object.fromEntries(entries) as unknown as UserData;
}
