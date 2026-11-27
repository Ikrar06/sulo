// Everything the popup shows, computed from stored data. Pure, so the popup,
// the badge and the dev preview all use the same logic.

import { activeCourseIds } from '../courses/active-score';
import { assignCourseColors } from '../courses/colors';
import { courseAlias } from '../courses/display-name';
import type { CopyItem } from '../format/copy-list';
import { formatDue, localeOf } from '../format/time';
import { calendarDaysBetween, countdownOrLate, formatDueClock, formatLeft, formatRemaining } from '../format/time';
import { id, type Messages } from '../i18n/id';
import type { DueFormat } from '../prefs';
import { DAILY_BUDGET, DAILY_CALL_BUDGET, SOFT_DAILY_POSTS, STALE_WARNING_H } from '../moodle/limits';
import { isStale } from '../staleness';
import type { SyncStatus, UserData } from '../storage';
import { taskMarkers } from '../radar/log';
import { getTaskState } from '../tasks/local-state';
import { applyPersonalDue } from '../tasks/personal-due';
import { localParts } from '../reminders/zoned';
import { badgeCount, GROUP_ORDER, groupTasks, pendingTasks, urgencyOf, type TaskGroupKey, type Urgency } from '../tasks/group';
import type { BudgetState, RemoteConfig, SessionState, UnixSeconds, ChangeLogEntry } from '../types';
import type { AccountPending } from '../account/pending';
import type { CalendarHighlight } from '../calendar/highlight-key';
import { countdownOf, type Countdown } from '../calendar/countdown';
import { accountStatus, decidePopupScreen, setupStatus, type PopupScreen } from '../account/state';
import { followsTask, isOwnTask } from '../tasks/own';

export type MascotState = 'idle' | 'syncing' | 'all-done' | 'celebrate' | 'urgent' | 'sleepy' | 'stale' | 'dizzy' | 'onboarding';

export type Banner =
  | { kind: 'disabled_remotely'; message: string }
  /** The session ended; lastSyncAt dates the data still shown (M7.2). */
  | { kind: 'session_expired'; lastSyncAt: UnixSeconds | null }
  | { kind: 'offline' }
  /** A sync is running (after signing in again, Perbarui, or on its own): the old data stays on screen. */
  | { kind: 'syncing' }
  /** The last sync could not read SIKOLA's answer (PARSER_BROKEN). */
  | { kind: 'parser_broken' }
  /** Today's request budget is spent: nothing more until tomorrow (no numbers shown). */
  | { kind: 'limit' }
  /** Past the soft daily limit: automatic syncs run less often for the rest of today. */
  | { kind: 'saver' }
  | { kind: 'stale'; lastSyncAt: UnixSeconds | null }
  /** Lowest priority: notifications are blocked in Chrome, so reminders cannot show. */
  | { kind: 'notifications_off' };

export interface TaskRow {
  eventId: number;
  name: string;
  /** Course name without class letter, as the row's second line. */
  courseName: string;
  /** 1..8, the course dot color token. */
  courseColor: number;
  url: string;
  /** Urgency always follows the time left, whatever the display format. */
  urgency: Urgency;
  dueAt: UnixSeconds | null;
  /** "Sisa waktu": "5 jam", "besok 23.59". */
  remaining: string;
  /** Duration for "Keduanya": "5 jam lagi". */
  left: string;
  /** "Jam tenggat": "Kamis 23.59". */
  clock: string;
  /** Tooltip: full date and time with the zone abbreviation. */
  fullDate: string;
  /** At least 7 calendar days away: "Keduanya" shows only the date and time. */
  far: boolean;
  /** Reminder snoozed until this time (only while still in the future). */
  snoozedUntil: UnixSeconds | null;
  /** "Baru" (new task) or "Tenggat berubah": 24 hours or 3 popup opens. */
  marker: 'new' | 'due_changed' | null;
  /** The due date is the user's own (the task has none in SIKOLA). */
  personalDue: boolean;
}

export interface DueText {
  primary: string;
  /** Second line under the primary text ("Keduanya"). */
  secondary: string | null;
  /** The primary text ticks every second (countdown, not yet overdue). */
  ticking: boolean;
}

/** What a task row shows on the right, per the chosen format (text only). */
export function dueText(row: TaskRow, format: DueFormat, now: UnixSeconds, timeZone: string, m: Messages = id): DueText {
  if (row.dueAt === null) return { primary: row.remaining, secondary: null, ticking: false };
  const overdue = row.dueAt < now;
  switch (format) {
    case 'remaining':
      return { primary: row.remaining, secondary: null, ticking: false };
    case 'clock':
      return { primary: row.clock, secondary: null, ticking: false };
    case 'countdown':
      return { primary: countdownOrLate(row.dueAt, now, timeZone, m), secondary: null, ticking: !overdue };
    case 'both':
      if (row.far) return { primary: row.clock, secondary: null, ticking: false };
      return { primary: row.left, secondary: row.clock, ticking: false };
  }
}

export interface TaskGroupView {
  key: TaskGroupKey;
  rows: TaskRow[];
  /** "Nanti" and "Tanpa tenggat" start folded (docs/UI). */
  collapsedByDefault: boolean;
}

export interface PopupView {
  /** Which screen (lib/account/state.ts): setup, another account, or the list. */
  screen: PopupScreen;
  /** Another account: the user chose "Nanti" (a shorter note, same choices). */
  mismatchDeferred: boolean;
  onboarded: boolean;
  banner: Banner | null;
  mascot: MascotState;
  syncing: boolean;
  lastSyncAt: UnixSeconds | null;
  groups: TaskGroupView[];
  pendingCount: number;
  inactiveCourseTaskCount: number;
  probablySubmittedCount: number;
  reviewSuggestedCount: number;
  copyItems: CopyItem[];
  badge: { text: string; tone: 'urgent' | 'neutral' | 'expired' };
  budget: BudgetState;
  /** "Kabar terbaru" entries not yet seen. */
  updatesUnseen: number;
  /** The change log, newest first (for the "Kabar terbaru" panel). */
  updates: ChangeLogEntry[];
  /** Course names by id, for the panel and notifications. */
  courseNames: Record<string, string>;
  /** Course color numbers (1 to 8) by id, for chips; only the followed courses have one. */
  courseColors: Record<string, number>;
  /** "Tanggal penting" line under the title; null hides it. */
  important: { judul: string; countdown: Countdown } | null;
}

export interface PopupInput {
  user: UserData | null;
  session: SessionState;
  syncStatus: SyncStatus;
  remoteConfig: RemoteConfig;
  budget: BudgetState;
  budgetLimit: number;
  now: UnixSeconds;
  timeZone: string;
  /** navigator.onLine at render time; omitted means online. */
  online?: boolean;
  /** Active dictionary; Indonesian when omitted (badge, tests). */
  messages?: Messages;
  /** A sync holds a live lock (lib/sync/lock.ts): "Sedang memperbarui". */
  syncing?: boolean;
  /** chrome.notifications permission; omitted means granted. */
  notificationsAllowed?: boolean;
  /** Another SIKOLA account signed in (global:accountPending); omitted means none. */
  accountPending?: AccountPending | null;
  /** Nearest academic calendar date, computed by the background; omitted means none. */
  calendarHighlight?: CalendarHighlight | null;
}

/** Offline: the browser says so, or the last request failed at the network level. */
const offline = (input: PopupInput) =>
  input.online === false || input.syncStatus.lastOutcome?.status === 'offline' || input.session === 'OFFLINE';

/**
 * The one status message for the popup and the dashboard (shared, never
 * duplicated). Users only see what they can act on: an expired session,
 * being offline, blocked notifications, a remote pause. Budgets, backoff and
 * parser trouble are never named; when data is more than 12 hours old for
 * any other reason, one plain "could not update since" line covers it.
 */
export function bannerFor(input: PopupInput, stale: boolean): Banner | null {
  if (!input.remoteConfig.enabled) return { kind: 'disabled_remotely', message: input.remoteConfig.message };
  if (input.session === 'EXPIRED') return { kind: 'session_expired', lastSyncAt: input.user?.sync.lastSyncAt ?? null };
  if (offline(input)) return { kind: 'offline' };
  // Updating says so in words, over the older status lines (the same pattern as the Android app, 20 Nov 2026).
  if (input.syncing) return { kind: 'syncing' };
  if (input.syncStatus.lastOutcome?.status === 'parser_broken') return { kind: 'parser_broken' };
  const today = input.budget.date === localParts(input.now, input.timeZone).dateKey;
  if (today && (input.budget.used >= DAILY_BUDGET || (input.budget.calls ?? 0) >= DAILY_CALL_BUDGET)) return { kind: 'limit' };
  if (today && input.budget.used >= SOFT_DAILY_POSTS) return { kind: 'saver' };
  if (stale && input.user?.sync.lastSyncAt) return { kind: 'stale', lastSyncAt: input.user.sync.lastSyncAt };
  if (input.notificationsAllowed === false) return { kind: 'notifications_off' };
  return null;
}

export function buildPopupView(input: PopupInput): PopupView {
  const pendingAccount = input.accountPending ?? null;
  const account = accountStatus({ hasUser: input.user !== null, session: input.session, pending: pendingAccount });
  const screen = decidePopupScreen(account, setupStatus({ hasUser: input.user !== null, completedAt: input.user?.onboarding.completedAt ?? null }));
  if (screen === 'mismatch') return mismatchView(input, pendingAccount?.deferredAt !== null && pendingAccount?.deferredAt !== undefined);

  const { user, now, timeZone } = input;
  const lastSyncAt = user?.sync.lastSyncAt ?? null;
  const stale = isStale(lastSyncAt, now);
  const banner = bannerFor(input, stale);
  const onboarded = Boolean(user?.onboarding.completedAt);

  const courses = user?.courses ?? [];
  const active = activeCourseIds(courses);
  const activeCourses = courses.filter((c) => active.has(c.id));
  const colors = assignCourseColors(activeCourses);
  const byId = new Map(courses.map((c) => [c.id, c]));

  const state = user?.taskState ?? {};
  // A personal due date (set in the dashboard) stands in for a missing one.
  const { tasks, personal } = applyPersonalDue(user?.tasks ?? [], state);
  const pending = pendingTasks(tasks, state, active);
  const grouped = groupTasks(pending, now, timeZone);

  const m = input.messages ?? id;
  const updates = user?.changes ?? [];
  const markers = taskMarkers(updates, now);
  const snoozeOf = (eventId: number) => {
    const until = getTaskState(state, eventId).snoozedUntil;
    return until !== null && until > now ? until : null;
  };
  const toRow = (t: (typeof pending)[number]): TaskRow => {
    const course = byId.get(t.courseId);
    return {
      eventId: t.eventId,
      name: t.name,
      courseName: course ? courseAlias(course) : isOwnTask(t) ? m.popup.row.ownTask : '',
      courseColor: colors.get(t.courseId) ?? 1,
      url: t.url,
      urgency: urgencyOf(t.dueAt, now),
      dueAt: t.dueAt,
      remaining: t.dueAt === null ? m.popup.copy.noDue : formatRemaining(t.dueAt, now, timeZone, m),
      left: t.dueAt === null ? '' : formatLeft(t.dueAt, now, timeZone, m),
      clock: t.dueAt === null ? '' : formatDueClock(t.dueAt, now, timeZone, m),
      fullDate: t.dueAt === null ? '' : formatDue(t.dueAt, localeOf(m), timeZone),
      far: t.dueAt !== null && t.dueAt > now && calendarDaysBetween(now, t.dueAt, timeZone) >= 7,
      snoozedUntil: snoozeOf(t.eventId),
      marker: markers.get(t.eventId) ?? null,
      personalDue: personal.has(t.eventId),
    };
  };

  const groups = GROUP_ORDER.map((key) => ({
    key,
    rows: grouped[key].map(toRow),
    collapsedByDefault: key === 'later' || key === 'undated',
  })).filter((g) => g.rows.length > 0);

  const urgentCount = badgeCount(pending, now);
  const sessionExpired = input.session === 'EXPIRED';
  const last = input.syncStatus.lastOutcome;

  let mascot: MascotState = 'idle';
  if (!onboarded) mascot = 'onboarding';
  else if (input.syncing) mascot = 'syncing';
  else if (last?.status === 'parser_broken') mascot = 'dizzy';
  else if (sessionExpired) mascot = 'sleepy';
  else if (stale || offline(input)) mascot = 'stale';
  else if (urgentCount > 0) mascot = 'urgent';
  else if (pending.length === 0 && lastSyncAt) mascot = 'all-done';

  return {
    screen,
    mismatchDeferred: false,
    onboarded,
    banner,
    mascot,
    syncing: input.syncing ?? false,
    lastSyncAt,
    groups,
    pendingCount: pending.length,
    inactiveCourseTaskCount: tasks.filter((t) => t.missingSince === null && !followsTask(active, t)).length,
    probablySubmittedCount: tasks.filter((t) => t.missingSince !== null).length,
    reviewSuggestedCount: user?.onboarding.reviewSuggested.length ?? 0,
    copyItems: pending.map((task) => {
      const course = byId.get(task.courseId);
      return { courseName: course ? courseAlias(course) : '', task };
    }),
    // An expired session reads like stale data (M7.2): the count from the last data, in grey; no "!" and no red.
    badge: {
      text: urgentCount > 0 ? (urgentCount > 99 ? '99+' : String(urgentCount)) : '',
      tone: sessionExpired || stale ? 'neutral' : 'urgent',
    },
    budget: input.budget,
    updatesUnseen: updates.filter((e) => !e.seen).length,
    updates,
    courseNames: Object.fromEntries(courses.map((c) => [String(c.id), courseAlias(c)])),
    courseColors: Object.fromEntries([...colors].map(([id, n]) => [String(id), n])),
    important:
      onboarded && input.calendarHighlight
        ? { judul: input.calendarHighlight.judul, countdown: countdownOf(input.calendarHighlight, localParts(now, timeZone).dateKey) }
        : null,
  };
}

/**
 * Another account is signed in: nothing of the stored account is shown (no
 * tasks, counts, updates or course names). The badge reads "!" in the same
 * color as an expired session; the popup explains.
 */
function mismatchView(input: PopupInput, deferred: boolean): PopupView {
  return {
    screen: 'mismatch',
    mismatchDeferred: deferred,
    onboarded: false,
    banner: null,
    // Not asleep: sleepy is only for an ended session (owner's decision, 23 Nov 2026). The data is set aside, so stale.
    mascot: 'stale',
    syncing: input.syncing ?? false,
    lastSyncAt: null,
    groups: [],
    pendingCount: 0,
    inactiveCourseTaskCount: 0,
    probablySubmittedCount: 0,
    reviewSuggestedCount: 0,
    copyItems: [],
    badge: { text: '!', tone: 'expired' },
    budget: input.budget,
    updatesUnseen: 0,
    updates: [],
    courseNames: {},
    courseColors: {},
    important: null,
  };
}

export { STALE_WARNING_H };
