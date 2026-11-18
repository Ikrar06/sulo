// Platform adaptors (M8a). Everything packages/core needs from the device
// comes through these interfaces, injected by the app that runs it:
// apps/extension implements them with chrome.* (apps/extension/src/platform),
// the Android app (M8b) with Capacitor plugins. packages/core itself never
// touches chrome.*, browser.*, wxt or the DOM (packages/core/tsconfig.json
// has no DOM library; scripts/check-platform-imports.mjs checks the rest).

import type { NotificationView } from '../reminders/text';
import type { Locale as Language } from '../i18n';
import type { Clock, FetchLike, KeyValueStore as StoreAccess, UnixSeconds } from '../types';

export type { Clock, FetchLike, StoreAccess };

export interface StorageChange {
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Local data (tasks, settings, snapshots). get/set/remove/keys are what the
 * logic uses (StoreAccess); watch tells the UI and the scheduler that keys
 * changed, from this context or another one.
 */
export interface KeyValueStore extends StoreAccess {
  /** Calls `listener` with the changed keys; returns a function that stops it. */
  watch(listener: (changes: Record<string, StorageChange>) => void): () => void;
}

/**
 * Secrets: the SIKOLA sesskey in the extension (session storage, gone when
 * the browser closes), the session cookie on Android (Keystore-encrypted).
 * Never logged, never in a bug report, never exported.
 */
export interface SecretStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface AlarmWhen {
  /** A single wake-up at this time. */
  at?: UnixSeconds;
  /** A single wake-up this many minutes from now (or the first one, with periodMinutes). */
  delayMinutes?: number;
  /** Then again every this many minutes. */
  periodMinutes?: number;
}

export interface ScheduledAlarm {
  name: string;
  /** Next wake-up. */
  at: UnixSeconds;
  periodMinutes: number | null;
}

/** Wake-ups for syncs and reminders. A name has at most one alarm; scheduling it again replaces it. */
export interface AlarmScheduler {
  schedule(name: string, when: AlarmWhen): Promise<void>;
  /** True when an alarm by that name existed. */
  cancel(name: string): Promise<boolean>;
  list(): Promise<ScheduledAlarm[]>;
  onAlarm(listener: (name: string) => void): () => void;
}

/** System notifications. The text comes from reminders/text (never grades or GPA). */
export interface Notifier {
  /** Shows a notification; throws when it could not be created. */
  show(id: string, view: NotificationView, options?: { silent?: boolean; lowPriority?: boolean }): Promise<void>;
  clear(id: string): Promise<boolean>;
  onClick(listener: (id: string) => void): () => void;
}

/**
 * Requests to SIKOLA, with the platform's own credentials: the browser's
 * cookies in the extension, the WebView's session cookie on Android. Only
 * moodle/client calls it, and only through its budget, queue and backoff.
 */
export interface HttpClient {
  request: FetchLike;
}

/** The interface language in use (the user's choice, else the system's). */
export interface Locale {
  current(): Promise<Language>;
}

/** Everything one app provides to packages/core. */
export interface Platform {
  store: KeyValueStore;
  secrets: SecretStore;
  alarms: AlarmScheduler;
  notifier: Notifier;
  http: HttpClient;
  clock: Clock;
  locale: Locale;
}
