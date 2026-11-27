// Typed storage with per-user keys. Data of one SIKOLA account never mixes
// with another: when the userid changes, the previous user's data is deleted
// before anything new is written. Pure: the KeyValueStore is injected.

import { EMPTY_PRESENSI, type PresensiData } from './presensi/types';
import type { TaskStateMap } from './tasks/local-state';
import type { ChangeLogEntry, CourseId, CourseRecord, CourseSnapshot, KeyValueStore, SyncOutcome, Task, UnixSeconds, UserId } from './types';
import { withOwnTasks, type OwnTask } from './tasks/own';
import type { TaskGrades } from './tasks/grade-service';

export const CURRENT_USER_KEY = 'global:currentUser';
export const NOTICE_KEY = 'global:notice';

/** Version of the privacy notice shown in onboarding step 1. Bump when its text changes. */
/** 2: 1.1.0 (Pantau tugas baru keeps the session, Sipakamase, MKPK; the privacy text changed). */
export const NOTICE_VERSION = 2;

export interface SyncMeta {
  /** Last successful sync for this user. */
  lastSyncAt: UnixSeconds | null;
  lastCourseListAt: UnixSeconds | null;
}

/** Last attempt, kept globally because the userid is unknown before the first success. */
export const SYNC_STATUS_KEY = 'global:syncStatus';

export interface SyncStatus {
  lastAttemptAt: UnixSeconds | null;
  lastOutcome: SyncOutcome | null;
  /** True while a sync is running, for the "syncing" mascot. */
}

export const DEFAULT_SYNC_STATUS: SyncStatus = { lastAttemptAt: null, lastOutcome: null };

export async function readSyncStatus(store: KeyValueStore): Promise<SyncStatus> {
  return (await store.get<SyncStatus>(SYNC_STATUS_KEY)) ?? DEFAULT_SYNC_STATUS;
}

export interface OnboardingState {
  completedAt: UnixSeconds | null;
  /** In-progress course ids at the user's last confirmation of active courses. */
  confirmedInProgress: CourseId[];
  /** In-progress courses that appeared since: the popup offers a review. */
  reviewSuggested: CourseId[];
  /** Optional onboarding steps the user skipped ("Lewati dulu"); offered again later. */
  skippedSteps?: string[];
}

/** Local counters, never sent anywhere (shown in the dev info panel). */
export interface LocalStats {
  notifyFailures: number;
  lastNotifyFailureAt: UnixSeconds | null;
  /** get_state failures for one course with an access error (skipped 24 hours). */
  courseAccessFailures?: number;
  /** get_state failures with a server or unknown error (retried at the next check). */
  courseOtherFailures?: number;
}

/** A course whose structure could not be read with an access error. */
export interface CourseAccess {
  /** Access failures in a row; reset by a successful read. */
  failures: number;
  lastFailedAt: UnixSeconds;
  lastErrorcode: string;
  /** 3 failures in a row: shown later in the course settings (M5a). */
  flagged: boolean;
}

export interface UserData {
  courses: CourseRecord[];
  tasks: Task[];
  taskState: TaskStateMap;
  sync: SyncMeta;
  onboarding: OnboardingState;
  /** Notification keys already sent, with the time (docs/ARCHITECTURE.md section 9). */
  notified: Record<string, UnixSeconds>;
  stats: LocalStats;
  /** "Kabar terbaru": at most 200 newest change entries (lib/radar/log.ts). */
  changes: ChangeLogEntry[];
  /** Course structure snapshots, keyed by course id (lib/radar/diff.ts). */
  snapshots: Record<string, CourseSnapshot>;
  radar: RadarMeta;
  /** Attendance (M7.3): monitored courses only, fetched when the Presensi page is opened. */
  presensi: PresensiData;
  /** Tasks the student added (tasks/own.ts): never synced, joined to `tasks` only in views and reminders. */
  ownTasks: OwnTask[];
  /** "Lihat nilai" answers by cmid (tasks/grade-service.ts): read on the student's tap, kept 24 hours, never sent or copied. */
  taskGrades: TaskGrades;
}

export interface RadarMeta {
  /** When each course's structure was last checked (rotation, 6-hour gap). */
  stateCheckedAt: Record<string, UnixSeconds>;
  /** Highest Moodle notification id seen; null until the baseline fetch. */
  notificationsLastId: number | null;
  /** The first calendar sync with the radar on is a silent baseline. */
  calendarBaseline: boolean;
  /** Courses that failed with an access error, keyed by course id. */
  courseAccess?: Record<string, CourseAccess>;
  /** Last successful notification fetch (3-hour TTL). */
  notificationsFetchedAt?: UnixSeconds;
  /** The last small page (10) was all new: fetch the full page (20) next time. */
  notificationsWide?: boolean;
  /** What the last radar pass did (codes and counts only), for the diagnosis in Pengaturan. */
  lastRun?: RadarRun;
}

export interface RadarRun {
  at: UnixSeconds;
  /** Course structures asked for in this sync. */
  planned: number;
  /** Structures stored (baseline or diff). */
  stored: number;
  /** Moodle error codes (or "parser_broken") per count. */
  errors: Record<string, number>;
  notifications: 'ok' | 'skipped' | 'broken' | 'error';
  /** Why the radar did not run at all, or the exception that stopped a part (name only). */
  failure?: string;
}

export const DEFAULTS: { [K in keyof UserData]: UserData[K] } = {
  courses: [],
  tasks: [],
  taskState: {},
  sync: { lastSyncAt: null, lastCourseListAt: null },
  onboarding: { completedAt: null, confirmedInProgress: [], reviewSuggested: [] },
  notified: {},
  stats: { notifyFailures: 0, lastNotifyFailureAt: null },
  changes: [],
  snapshots: {},
  radar: { stateCheckedAt: {}, notificationsLastId: null, calendarBaseline: false },
  presensi: EMPTY_PRESENSI,
  ownTasks: [],
  taskGrades: {},
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

/**
 * Removes every u:{id}:* key whose id is not the active account (nor an
 * account waiting for confirmation, Tahap 2). Catches keys a late write left
 * behind after an account switch. Returns the removed keys.
 */
export async function pruneOrphanUserKeys(store: KeyValueStore, keep: readonly (UserId | null)[] = []): Promise<string[]> {
  // Keys first, the active account second. A sync writes global:currentUser
  // before the account's u:{id}:* keys, so any key listed here belongs to an
  // account that is already current when it is read afterwards. The other
  // order deleted a first account's data written in between (worker start
  // racing the first sync).
  const keys = await store.keys('u:');
  const active = await currentUser(store);
  const allowed = [active, ...keep].filter((id): id is UserId => id !== null).map((id) => `u:${id}:`);
  const orphans = keys.filter((k) => !allowed.some((prefix) => k.startsWith(prefix)));
  if (orphans.length > 0) await store.remove(orphans);
  return orphans;
}

/** Writes only while `userId` is still the active account (compare-and-set). */
export async function writeUserIfCurrent<K extends keyof UserData>(store: KeyValueStore, userId: UserId, name: K, value: UserData[K]): Promise<boolean> {
  if ((await currentUser(store)) !== userId) return false;
  await writeUser(store, userId, name, value);
  return true;
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

/**
 * Reads every user key at once, with defaults, for building views. `tasks` here holds SIKOLA's tasks and
 * the ones the student added (tasks/own.ts); sync and Radar read `tasks` alone, through readUser.
 */
export async function readAllUser(store: KeyValueStore, userId: UserId): Promise<UserData> {
  const entries = await Promise.all(
    (Object.keys(DEFAULTS) as (keyof UserData)[]).map(async (name) => [name, await readUser(store, userId, name)] as const),
  );
  const data = Object.fromEntries(entries) as unknown as UserData;
  return { ...data, tasks: withOwnTasks(data.tasks, data.ownTasks) };
}
