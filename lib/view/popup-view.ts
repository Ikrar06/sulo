// Everything the popup shows, computed from stored data. Pure, so the popup,
// the badge and the dev preview all use the same logic.

import { activeCourseIds } from '../courses/active-score';
import { assignLabels } from '../courses/short-label';
import { courseNameWithClass } from '../courses/display-name';
import type { CopyItem } from '../format/copy-list';
import { formatFullDate, formatRemaining } from '../format/time';
import { STALE_WARNING_H } from '../moodle/limits';
import { isStale } from '../staleness';
import type { SyncStatus, UserData } from '../storage';
import { badgeCount, GROUP_ORDER, groupTasks, pendingTasks, urgencyOf, type TaskGroupKey, type Urgency } from '../tasks/group';
import type { BudgetState, RemoteConfig, SessionState, UnixSeconds } from '../types';

export type MascotState = 'idle' | 'syncing' | 'all-done' | 'celebrate' | 'urgent' | 'sleepy' | 'dizzy' | 'onboarding';

export type Banner =
  | { kind: 'disabled_remotely'; message: string }
  | { kind: 'session_expired' }
  | { kind: 'parser_broken' }
  | { kind: 'budget_exhausted' }
  | { kind: 'offline' }
  | { kind: 'stale'; hours: number | null };

export interface TaskRow {
  eventId: number;
  name: string;
  courseLabel: string;
  courseName: string;
  url: string;
  urgency: Urgency;
  remaining: string;
  fullDate: string;
}

export interface TaskGroupView {
  key: TaskGroupKey;
  rows: TaskRow[];
  /** "Nanti" and "Tanpa tenggat" start folded (docs/UI). */
  collapsedByDefault: boolean;
}

export interface PopupView {
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
}

function bannerFor(input: PopupInput, stale: boolean, hours: number | null): Banner | null {
  if (!input.remoteConfig.enabled) return { kind: 'disabled_remotely', message: input.remoteConfig.message };
  if (input.session === 'EXPIRED') return { kind: 'session_expired' };
  const last = input.syncStatus.lastOutcome;
  if (last?.status === 'parser_broken') return { kind: 'parser_broken' };
  if (input.budget.used >= input.budgetLimit || (last?.status === 'skipped' && last.reason === 'BUDGET_EXHAUSTED')) {
    return { kind: 'budget_exhausted' };
  }
  if (last?.status === 'offline' || input.session === 'OFFLINE') return { kind: 'offline' };
  if (stale && input.user?.sync.lastSyncAt) return { kind: 'stale', hours };
  return null;
}

export function buildPopupView(input: PopupInput): PopupView {
  const { user, now, timeZone } = input;
  const lastSyncAt = user?.sync.lastSyncAt ?? null;
  const stale = isStale(lastSyncAt, now);
  const hours = lastSyncAt ? Math.floor((now - lastSyncAt) / 3600) : null;
  const banner = bannerFor(input, stale, hours);
  const onboarded = Boolean(user?.onboarding.completedAt);

  const courses = user?.courses ?? [];
  const active = activeCourseIds(courses);
  const activeCourses = courses.filter((c) => active.has(c.id));
  const labels = assignLabels(activeCourses);
  const byId = new Map(courses.map((c) => [c.id, c]));

  const tasks = user?.tasks ?? [];
  const state = user?.taskState ?? {};
  const pending = pendingTasks(tasks, state, active);
  const grouped = groupTasks(pending, now, timeZone);

  const toRow = (t: (typeof pending)[number]): TaskRow => {
    const course = byId.get(t.courseId);
    return {
      eventId: t.eventId,
      name: t.name,
      courseLabel: labels.get(t.courseId) ?? '?',
      courseName: course ? courseNameWithClass(course) : '',
      url: t.url,
      urgency: urgencyOf(t.dueAt, now),
      remaining: t.dueAt === null ? 'tanpa tenggat' : formatRemaining(t.dueAt, now, timeZone),
      fullDate: t.dueAt === null ? '' : formatFullDate(t.dueAt, timeZone),
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
  else if (input.syncStatus.running) mascot = 'syncing';
  else if (last?.status === 'parser_broken') mascot = 'dizzy';
  else if (sessionExpired || stale || last?.status === 'offline') mascot = 'sleepy';
  else if (urgentCount > 0) mascot = 'urgent';
  else if (pending.length === 0 && lastSyncAt) mascot = 'all-done';

  return {
    onboarded,
    banner,
    mascot,
    syncing: input.syncStatus.running,
    lastSyncAt,
    groups,
    pendingCount: pending.length,
    inactiveCourseTaskCount: tasks.filter((t) => t.missingSince === null && !active.has(t.courseId)).length,
    probablySubmittedCount: tasks.filter((t) => t.missingSince !== null).length,
    reviewSuggestedCount: user?.onboarding.reviewSuggested.length ?? 0,
    copyItems: pending.map((task) => ({ courseLabel: labels.get(task.courseId) ?? '?', task })),
    badge: {
      text: sessionExpired ? '!' : urgentCount > 0 ? (urgentCount > 99 ? '99+' : String(urgentCount)) : '',
      tone: sessionExpired ? 'expired' : stale ? 'neutral' : 'urgent',
    },
    budget: input.budget,
  };
}

export { STALE_WARNING_H };
