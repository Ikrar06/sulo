// Type contract for Sulo, moved from contracts/types.ts during M0.
// Adjust field names once real, sanitized fixtures confirm the exact
// Moodle response shapes (M1).

export type UserId = number;
export type CourseId = number;
export type CmId = number;
export type UnixSeconds = number;

// ---------- Session ----------

export type SessionState = 'UNKNOWN' | 'OK' | 'EXPIRED' | 'OFFLINE';

export interface SessionInfo {
  state: SessionState;
  userId: UserId | null;
  checkedAt: UnixSeconds;
  /** When the session entered EXPIRED (one notification per event); null otherwise. */
  expiredAt?: UnixSeconds | null;
}

// ---------- Request safety ----------

/** What triggered a request to SIKOLA, for the per-source request counter. */
export type RequestSource =
  | 'background'
  | 'popup'
  | 'manual'
  | 'onboarding'
  /** Removed message (connection test); kept so older counts still show a label. */
  | 'connection-test'
  | 'sesskey-fallback'
  | 'recorder';

export interface BudgetState {
  /** Local date, YYYY-MM-DD. Budget resets when this changes. */
  date: string;
  used: number;
  /** Requests per trigger today. */
  bySource?: Partial<Record<RequestSource, number>>;
  /** Requests today that also carried the daily course list. */
  withCourseList?: number;
}

export interface BackoffState {
  failures: number;
  nextAllowedAt: UnixSeconds;
}

export interface RemoteConfig {
  enabled: boolean;
  minIntervalMinutes: number;
  message: string;
  fetchedAt: UnixSeconds;
}

export type ClientRefusal =
  | 'BUDGET_EXHAUSTED'
  | 'BACKING_OFF'
  | 'SESSION_EXPIRED'
  | 'NO_SESSKEY'
  | 'DISABLED_REMOTELY'
  | 'NOT_ALLOWLISTED';

// ---------- Courses ----------

export interface ParsedCourseName {
  /** Course name without class letter, program and code. The full name when unmatched. */
  name: string;
  classLetter: string | null;
  program: string | null;
  /** 11-character course code in square brackets, e.g. 23D01234567. */
  code: string | null;
  matched: boolean;
}

export type ActiveReason = 'inprogress' | 'enddate_future' | 'upcoming_events' | 'past' | 'ended_long_ago';

export interface CourseRecord {
  id: CourseId;
  fullname: string;
  shortname: string;
  startdate: UnixSeconds;
  enddate: UnixSeconds; // 0 when not set
  parsed: ParsedCourseName;
  /** Classification flags from the last course list fetch. */
  inProgress: boolean;
  past: boolean;
  /** Computed by lib/courses/active-score.ts, kept for review. */
  activeScore: number;
  activeReasons: ActiveReason[];
  /** Manual pin. null means "follow the score". */
  activePin: boolean | null;
  /** User overrides (dashboard, M5a). null means "use the default". */
  alias: string | null;
  /** "course-1" .. "course-8" when chosen by the user (M5a); null means automatic. */
  color: string | null;
}

// ---------- Tasks (from calendar action events) ----------

export interface Task {
  /** Calendar event id. Stable key for reminders. */
  eventId: number;
  cmId: CmId | null;
  courseId: CourseId;
  name: string;
  /** Module code from the calendar's `modulename` ('assign', 'quiz'). Never the translated name. */
  module: string;
  /** null for tasks without a due date */
  dueAt: UnixSeconds | null;
  url: string;
  overdue: boolean;
  firstSeenAt: UnixSeconds;
  lastSeenAt: UnixSeconds;
  /** Set when the task disappeared from the calendar: probably submitted. */
  missingSince: UnixSeconds | null;
}

export interface TaskLocalState {
  eventId: number;
  doneManually: boolean;
  snoozedUntil: UnixSeconds | null;
  steps: { id: string; text: string; done: boolean }[];
  note: string;
}

// ---------- Radar ----------

export const PARSER_VERSION = 1;

export interface SnapshotItem {
  cmId: CmId;
  /** Module code from the course state's `module` ('assign'). Not `modname`, which is translated. */
  module: string;
  name: string;
  sectionId: number;
  visible: boolean;
  /** False when access restrictions hide it from this user. */
  uservisible: boolean;
  url: string | null;
  firstSeenAt: UnixSeconds;
  /** Consecutive syncs in which this item was absent. */
  missCount: number;
}

export interface CourseSnapshot {
  userId: UserId;
  courseId: CourseId;
  fetchedAt: UnixSeconds;
  parserVersion: number;
  items: Record<string, SnapshotItem>; // keyed by cmId as string
}

/** A Moodle notification reduced to the fields Sulo may keep (docs/PRIVASI.md). */
export interface KeptNotification {
  id: number;
  subject: string;
  component: string;
  eventtype: string;
  timecreated: UnixSeconds;
  read: boolean;
  /** Filtered: SIKOLA only, allowlisted path, id parameters only; else null. */
  contexturl: string | null;
}

/**
 * Structure changes carry `since`: when the snapshot they were compared with
 * was taken. With the content it makes the log entry id deterministic: two
 * cycles comparing against the same snapshot produce the same id (one entry,
 * one notification), while a real repeat later has a newer `since`.
 */
type Since = { since: UnixSeconds };

export type Change =
  | ({ kind: 'added'; courseId: CourseId; cmId: CmId; module: string; name: string; url: string | null } & Since)
  | ({ kind: 'removed'; courseId: CourseId; cmId: CmId; module: string; name: string } & Since)
  | ({ kind: 'renamed'; courseId: CourseId; cmId: CmId; module: string; from: string; to: string; url: string | null } & Since)
  | ({ kind: 'hidden'; courseId: CourseId; cmId: CmId; module: string; name: string } & Since)
  | ({ kind: 'shown'; courseId: CourseId; cmId: CmId; module: string; name: string; url: string | null } & Since)
  | { kind: 'due_changed'; courseId: CourseId; eventId: number; cmId: CmId | null; name: string; from: UnixSeconds | null; to: UnixSeconds | null; url: string }
  | { kind: 'task_added'; courseId: CourseId; eventId: number; cmId: CmId | null; name: string; dueAt: UnixSeconds | null; url: string }
  /** Grades and feedback are one kind: component alone cannot tell them apart reliably. */
  | { kind: 'grade_feedback'; courseId: CourseId | null; notification: KeptNotification }
  | { kind: 'forum'; courseId: CourseId | null; notification: KeptNotification }
  /** Unknown component and eventtype pair: log only, no system notification. */
  | { kind: 'other_notification'; courseId: CourseId | null; notification: KeptNotification };

export interface ChangeLogEntry {
  /** Stable id, also the notification key ("c:" + id). */
  id: string;
  at: UnixSeconds;
  change: Change;
  /** Should produce a system notification (subject to settings and quiet hours). */
  notify: boolean;
  /** Seen in the "Kabar terbaru" panel. */
  seen: boolean;
  /** Popup opens since it was logged, for the "baru" marker on task rows. */
  opens: number;
}

export interface DiffResult {
  next: CourseSnapshot;
  changes: Change[];
  /** True when this run only established a baseline. */
  baseline: boolean;
}

// ---------- Parsers ----------

export interface ParseResult<T> {
  ok: boolean;
  rows: T[];
  warnings: string[];
}

// ---------- Sync ----------

export type SyncTrigger = 'background' | 'popup' | 'manual' | 'onboarding';

export type SyncOutcome =
  | { status: 'ok'; at: UnixSeconds; tasks: number; courseListFetched: boolean }
  | { status: 'skipped'; reason: ClientRefusal | 'QUIET_HOURS' | 'IDLE' | 'FRESH' | 'BUSY' }
  | { status: 'session_expired' }
  | { status: 'invalid_sesskey' }
  | { status: 'offline' }
  | { status: 'server_error' }
  | { status: 'parser_broken'; where: string };

// ---------- Settings ----------

export interface Settings {
  notifyDue: boolean;
  notifyChanges: boolean;
  notifyGrades: boolean;
  dueStagesHours: number[]; // default [72, 24, 3]
  quietStartHour: number;   // default 0
  quietEndHour: number;     // default 6
  onboarded: boolean;
}

// ---------- Injected dependencies (keep lib/moodle and lib/radar pure) ----------

export interface Clock {
  now(): UnixSeconds;
  localDate(): string;
  localHour(): number;
}

export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  keys(prefix: string): Promise<string[]>;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
