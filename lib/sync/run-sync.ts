// One sync cycle = one batch request to SIKOLA (docs: ARCHITECTURE section 4).
// Batch: session check + calendar, plus what is due (plan-batch.ts): the
// course list every 24 hours for every trigger, notifications every 3 hours,
// course structures every 6 hours. Low quota drops the optional parts.
// The popup never triggers a sync. Pure: client, store and clock are injected.

import { buildCourses, newInProgressIds } from '../courses/build';
import { scoreCourse } from '../courses/active-score';
import type { BatchOutcome, CallResult, MoodleClient } from '../moodle/client';
import { readBudget, remainingQuota } from '../moodle/budget';
import {
  CALENDAR_LOOKBACK_DAYS,
  CATCHUP_FRESH_MIN,
  COURSE_LIST_MIN_GAP_H,
  ONBOARDING_FRESH_MIN,
  SIKOLA_ORIGIN,
  TASKS_TTL_MIN,
  TTL_TOLERANCE_MIN,
} from '../moodle/limits';
import { applyRadarResults, planRadarCalls } from '../radar/sync-step';
import { recordFailure } from '../moodle/backoff';
import { planBatch } from './plan-batch';
import { parseCall } from '../moodle/schemas';
import { writeSession } from '../moodle/session';
import { backgroundBlockReason, type IdleState } from '../schedule';
import { DEFAULT_SYNC_STATUS, readSyncStatus, readUser, SYNC_STATUS_KEY, switchUser, writeUser, type SyncStatus } from '../storage';
import { mergeTasks, upcomingCourseIds } from '../tasks/from-calendar';
import { pruneTaskState } from '../tasks/local-state';
import type { Clock, CourseRecord, KeyValueStore, SyncOutcome, SyncTrigger, UnixSeconds, UserId } from '../types';
import { currentUser } from '../storage';

export interface SyncDeps {
  client: MoodleClient;
  store: KeyValueStore;
  clock: Clock;
  trigger: SyncTrigger;
  /** Required for background, startup and idle syncs (chrome.idle state). */
  idleState?: IdleState;
  /** "Segarkan daftar": fetch the course list even within 24 hours. */
  forceCourseList?: boolean;
  /** SIKOLA origin, for filtering notification links; defaults to SIKOLA_ORIGIN. */
  origin?: string;
}

export async function runSync(deps: SyncDeps): Promise<SyncOutcome> {
  const now = deps.clock.now();
  const skip = await skipReason(deps, now);
  if (skip) return skip;

  let outcome: SyncOutcome;
  try {
    outcome = await syncOnce(deps, now);
  } catch {
    outcome = { status: 'parser_broken', where: 'sync' };
  }
  await setStatus(deps.store, { lastAttemptAt: now, lastOutcome: outcome });
  return outcome;
}

/** Triggers that run without a click: quiet hours and idle apply. */
const UNATTENDED = new Set<SyncTrigger>(['background', 'startup', 'idle']);

/**
 * Data younger than this (minutes) makes a trigger skip without a request.
 * Background waits out the 3-hour TTL (minus slack for alarm timing);
 * catch-ups after startup or idle wait 60 minutes; setup reuses data from
 * the last 5 minutes; a click on "Perbarui" always runs.
 */
export function freshForMinutes(trigger: SyncTrigger): number {
  switch (trigger) {
    case 'background':
      return TASKS_TTL_MIN - TTL_TOLERANCE_MIN;
    case 'startup':
    case 'idle':
      return CATCHUP_FRESH_MIN;
    case 'onboarding':
      return ONBOARDING_FRESH_MIN;
    case 'manual':
      return 0;
  }
}

async function skipReason(deps: SyncDeps, now: UnixSeconds): Promise<SyncOutcome | null> {
  if (UNATTENDED.has(deps.trigger)) {
    const block = backgroundBlockReason(deps.clock, deps.idleState ?? 'idle');
    if (block) return { status: 'skipped', reason: block };
  }
  const freshFor = freshForMinutes(deps.trigger);
  if (freshFor > 0) {
    const userId = await currentUser(deps.store);
    const meta = userId === null ? null : await readUser(deps.store, userId, 'sync');
    // Setup also needs the course list; without one it always runs.
    const usable = deps.trigger !== 'onboarding' || (meta?.lastCourseListAt ?? null) !== null;
    if (usable && meta?.lastSyncAt && now - meta.lastSyncAt < freshFor * 60) return { status: 'skipped', reason: 'FRESH' };
  }
  return null;
}

async function courseListState(deps: SyncDeps, now: UnixSeconds): Promise<{ due: boolean; missing: boolean }> {
  const userId = await currentUser(deps.store);
  if (userId === null) return { due: true, missing: true };
  const meta = await readUser(deps.store, userId, 'sync');
  if (meta.lastCourseListAt === null) return { due: true, missing: true };
  return { due: deps.forceCourseList === true || now - meta.lastCourseListAt >= COURSE_LIST_MIN_GAP_H * 3600, missing: false };
}

async function syncOnce(deps: SyncDeps, now: UnixSeconds): Promise<SyncOutcome> {
  const courseList = await courseListState(deps, now);
  // Radar (M4): notifications and the structure of up to 5 active courses,
  // in the same batch: still one request per cycle.
  const knownUser = await currentUser(deps.store);
  const plan = planBatch({
    now,
    courseListDue: courseList.due,
    courseListMissing: courseList.missing,
    radar: await planRadarCalls(deps.store, knownUser, knownUser === null ? [] : await readUser(deps.store, knownUser, 'courses'), now),
    userId: knownUser,
    remaining: remainingQuota(await readBudget(deps.store, deps.clock)),
  });
  const { withCourseList, radar: radarPlan, radarStart } = plan;

  const result = await deps.client.callBatch(plan.calls, { source: deps.trigger, withCourseList });
  if (result.kind !== 'ok') return transportOutcome(result);

  const [sessionResult, calendarResult, allResult, inProgressResult] = result.results;
  const radarResults = result.results.slice(radarStart);
  const session = parseCall('core_session_time_remaining', sessionResult ?? missing);
  if (!session.ok) return { status: 'parser_broken', where: 'core_session_time_remaining' };
  const userId: UserId = session.data.userid;
  await switchUser(deps.store, userId);
  await writeSession(deps.store, deps.clock, 'OK', userId);

  const broken: string[] = [];

  const previousTasks = await readUser(deps.store, userId, 'tasks');
  let tasks = previousTasks;
  let calendarMerged = false;
  const calendar = parseCall('core_calendar_get_action_events_by_timesort', calendarResult ?? missing);
  if (calendar.ok) {
    calendarMerged = true;
    tasks = mergeTasks(previousTasks, calendar.data.events, now, CALENDAR_LOOKBACK_DAYS);
    await writeUser(deps.store, userId, 'tasks', tasks);
    const state = await readUser(deps.store, userId, 'taskState');
    await writeUser(deps.store, userId, 'taskState', pruneTaskState(state, new Set(tasks.map((t) => t.eventId))));
  } else {
    broken.push('core_calendar_get_action_events_by_timesort');
  }

  const upcoming = upcomingCourseIds(tasks, now);
  const previousCourses = await readUser(deps.store, userId, 'courses');
  let courses: CourseRecord[] = rescore(previousCourses, upcoming, now);
  let courseListFetched = false;
  if (withCourseList) {
    const all = parseCall('core_course_get_enrolled_courses_by_timeline_classification', allResult ?? missing);
    const inProgress = parseCall('core_course_get_enrolled_courses_by_timeline_classification', inProgressResult ?? missing);
    if (all.ok && inProgress.ok) {
      courses = buildCourses({
        all: all.data.courses,
        inProgressIds: new Set(inProgress.data.courses.map((c) => c.id)),
        upcomingCourseIds: upcoming,
        previous: previousCourses,
        now,
      });
      courseListFetched = true;
      await suggestReviewIfNeeded(deps.store, userId, courses);
    } else {
      broken.push('core_course_get_enrolled_courses_by_timeline_classification');
    }
  }
  await writeUser(deps.store, userId, 'courses', courses);

  // The radar only reads results for the user it planned for (a different
  // account was just wiped by switchUser and starts with its own baseline).
  if (knownUser === userId) {
    const radar = await applyRadarResults(deps.store, {
      userId,
      now,
      origin: deps.origin ?? SIKOLA_ORIGIN,
      plan: radarPlan,
      results: radarResults,
      previousTasks,
      nextTasks: calendarMerged ? tasks : null,
    });
    broken.push(...radar.broken);
    // Every course structure failed with a server error while the session
    // call worked: SIKOLA itself is in trouble. One domain failure for backoff.
    if (radar.sikolaTrouble) await recordFailure(deps.store, deps.clock, null);
  }

  const meta = await readUser(deps.store, userId, 'sync');
  await writeUser(deps.store, userId, 'sync', {
    lastSyncAt: broken.length === 0 ? now : meta.lastSyncAt,
    lastCourseListAt: courseListFetched ? now : meta.lastCourseListAt,
  });

  if (broken.length > 0) return { status: 'parser_broken', where: broken.join(', ') };
  return { status: 'ok', at: now, tasks: tasks.filter((t) => t.missingSince === null).length, courseListFetched };
}

/** Updates the "upcoming events" signal between daily course list fetches. */
function rescore(courses: readonly CourseRecord[], upcoming: ReadonlySet<number>, now: UnixSeconds): CourseRecord[] {
  return courses.map((c) => {
    const { score, reasons } = scoreCourse(
      { inProgress: c.inProgress, past: c.past, enddate: c.enddate, hasUpcomingEvents: upcoming.has(c.id) },
      now,
    );
    return { ...c, activeScore: score, activeReasons: reasons };
  });
}

/** A new semester never changes the user's choices silently: it only flags a review. */
async function suggestReviewIfNeeded(store: KeyValueStore, userId: UserId, courses: readonly CourseRecord[]): Promise<void> {
  const onboarding = await readUser(store, userId, 'onboarding');
  if (onboarding.completedAt === null) return;
  const fresh = newInProgressIds(courses, onboarding.confirmedInProgress);
  const same = fresh.length === onboarding.reviewSuggested.length && fresh.every((id) => onboarding.reviewSuggested.includes(id));
  if (!same) await writeUser(store, userId, 'onboarding', { ...onboarding, reviewSuggested: fresh });
}

const missing: CallResult = { ok: false, errorcode: 'missing_result' };

function transportOutcome(result: Exclude<BatchOutcome, { kind: 'ok' }>): SyncOutcome {
  switch (result.kind) {
    case 'refused':
      return { status: 'skipped', reason: result.reason };
    case 'login_required':
      return { status: 'session_expired' };
    case 'invalid_sesskey':
      return { status: 'invalid_sesskey' };
    // Offline only when the request never reached the network. A timeout
    // means SIKOLA is slow, which is a server problem, not the user's.
    case 'network_error':
      return { status: 'offline' };
    case 'timeout':
    case 'http_error':
      return { status: 'server_error' };
    case 'bad_response':
      return { status: 'parser_broken', where: 'transport' };
  }
}

async function setStatus(store: KeyValueStore, patch: Partial<SyncStatus>): Promise<void> {
  const current = await readSyncStatus(store).catch(() => DEFAULT_SYNC_STATUS);
  await store.set(SYNC_STATUS_KEY, { ...current, ...patch });
}
