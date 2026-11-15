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
}

// ---------- Request safety ----------

/** What triggered a request to SIKOLA, for the per-source request counter. */
export type RequestSource =
  | 'background'
  | 'popup'
  | 'manual'
  | 'onboarding'
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

export type Change =
  | { kind: 'added'; courseId: CourseId; cmId: CmId; module: string; name: string }
  | { kind: 'removed'; courseId: CourseId; cmId: CmId; module: string; name: string }
  | { kind: 'renamed'; courseId: CourseId; cmId: CmId; from: string; to: string }
  | { kind: 'hidden'; courseId: CourseId; cmId: CmId; name: string }
  | { kind: 'shown'; courseId: CourseId; cmId: CmId; name: string }
  | { kind: 'due_changed'; courseId: CourseId; eventId: number; name: string; from: UnixSeconds | null; to: UnixSeconds | null }
  | { kind: 'task_added'; courseId: CourseId; eventId: number; name: string; dueAt: UnixSeconds | null }
  | { kind: 'graded'; courseId: CourseId | null; notificationId: number; subject: string }
  | { kind: 'feedback'; courseId: CourseId | null; notificationId: number; subject: string }
  | { kind: 'forum_post'; courseId: CourseId | null; notificationId: number; subject: string };

export interface ChangeLogEntry {
  id: string;
  at: UnixSeconds;
  change: Change;
  /** Whether a system notification was shown for it. */
  notified: boolean;
  seen: boolean;
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
  | { status: 'skipped'; reason: ClientRefusal | 'QUIET_HOURS' | 'IDLE' | 'FRESH' }
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
