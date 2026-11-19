// One sync cycle = one batch request to SIKOLA (docs: ARCHITECTURE section 4).
// Batch: session check + calendar, plus what is due (plan-batch.ts): the
// course list every 24 hours for every trigger, notifications every 3 hours,
// course structures in turns (up to 4 per automatic sync, all on "Perbarui").
// Past the soft daily limit, automatic syncs run in saver mode (no course
// structures, at least 60 minutes apart); "Perbarui" stays a full sync.
// "Perbarui" within 2 minutes of a good sync sends nothing. Near the hard
// limit the optional parts drop. The popup never triggers a sync. Pure:
// client, store and clock are injected.

import { buildCourses, newInProgressIds } from '../courses/build';
import { scoreCourse } from '../courses/active-score';
import type { BatchOutcome, CallResult, MoodleClient } from '../moodle/client';
import { readBudget, remainingQuota } from '../moodle/budget';
import {
  CALENDAR_LOOKBACK_DAYS,
  CATCHUP_FRESH_MIN,
  COURSE_LIST_MIN_GAP_H,
  MANUAL_COOLDOWN_SEC,
  ONBOARDING_FRESH_MIN,
  RELOGIN_FRESH_MIN,
  SAVER_MIN_GAP_MIN,
  SIKOLA_ORIGIN,
  SOFT_DAILY_POSTS,
  TASKS_TTL_MIN,
  TTL_TOLERANCE_MIN,
} from '../moodle/limits';
import { applyRadarResults, planRadarCalls, type RadarMode } from '../radar/sync-step';
import { activeCourseIds } from '../courses/active-score';
import { readPresensi, refreshRecap } from '../presensi/service';
import { PRESENSI_CACHE_SEC } from '../presensi/rules';
import { recordFailure } from '../moodle/backoff';
import { planBatch, type BatchPlan } from './plan-batch';
import { ACCOUNT_PENDING_KEY, mayCheckWhilePending, newPending, readPending, resolveCheck, type AccountPending } from '../account/pending';
import { calls } from '../moodle/calls';
import { parseCall } from '../moodle/schemas';
import { writeSession } from '../moodle/session';
import { backgroundBlockReason, type IdleState } from '../schedule';
import { DEFAULT_SYNC_STATUS, readSyncStatus, readUser, SYNC_STATUS_KEY, switchUser, writeUser, type SyncStatus } from '../storage';
import { mergeTasks, upcomingCourseIds } from '../tasks/from-calendar';
import { pruneTaskState } from '../tasks/local-state';
import type { Clock, CourseRecord, KeyValueStore, SyncOutcome, SyncTrigger, Task, UnixSeconds, UserId } from '../types';
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
  /**
   * The real stages as they finish (the phone's "Menyiapkan Sulo" list):
   * tasks when the calendar answer was read, courses after the course list,
   * attendance after the recap. Never called for a stage that did not run.
   */
  onStage?: (stage: SyncStage, result: 'ok' | 'failed') => void;
}

export type SyncStage = 'tasks' | 'courses' | 'attendance';

/** A stage listener must never break a sync. */
function stage(deps: Pick<SyncDeps, 'onStage'>, s: SyncStage, result: 'ok' | 'failed') {
  try {
    deps.onStage?.(s, result);
  } catch {
    // ignored: the list on screen is only a view of the sync
  }
}

export async function runSync(deps: SyncDeps): Promise<SyncOutcome> {
  const now = deps.clock.now();
  const pending = await readPending(deps.store);
  const known = await currentUser(deps.store);
  if (pending && known !== null) return finish(deps, now, () => checkWhilePending(deps, known, pending, now));
  if (deps.trigger === 'sesskey') return { status: 'skipped', reason: 'NOT_NEEDED' };

  const skip = await skipReason(deps, now);
  if (skip) return skip;
  return finish(deps, now, () => syncOnce(deps, now));
}

async function finish(deps: SyncDeps, now: UnixSeconds, work: () => Promise<SyncOutcome>): Promise<SyncOutcome> {
  let outcome: SyncOutcome;
  try {
    outcome = await work();
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
    case 'relogin':
      return RELOGIN_FRESH_MIN;
    case 'manual':
    case 'sesskey':
      return 0;
  }
}

/** Which sync this is: "Perbarui" is always full; automatic syncs past the soft limit save. */
export function syncMode(trigger: SyncTrigger, postsToday: number): RadarMode {
  if (trigger === 'manual') return 'full';
  return UNATTENDED.has(trigger) && postsToday >= SOFT_DAILY_POSTS ? 'saver' : 'normal';
}

async function skipReason(deps: SyncDeps, now: UnixSeconds): Promise<SyncOutcome | null> {
  if (UNATTENDED.has(deps.trigger)) {
    const block = backgroundBlockReason(deps.clock, deps.idleState ?? 'idle');
    if (block) return { status: 'skipped', reason: block };
  }
  const mode = syncMode(deps.trigger, (await readBudget(deps.store, deps.clock)).used);
  // "Perbarui" right after a good sync: nothing to fetch, nothing sent ("Sudah terbaru").
  // Saver mode: automatic syncs at least an hour apart.
  const freshFor = deps.forceCourseList
    ? 0 // "Segarkan daftar" is an explicit request for the list: never "fresh enough".
    : deps.trigger === 'manual'
      ? MANUAL_COOLDOWN_SEC / 60
      : mode === 'saver'
        ? Math.max(SAVER_MIN_GAP_MIN, freshForMinutes(deps.trigger))
        : freshForMinutes(deps.trigger);
  if (freshFor > 0) {
    const userId = await currentUser(deps.store);
    const meta = userId === null ? null : await readUser(deps.store, userId, 'sync');
    // Setup also needs the course list; without one it always runs.
    const usable = deps.trigger !== 'onboarding' || (meta?.lastCourseListAt ?? null) !== null;
    if (usable && meta?.lastSyncAt && now - meta.lastSyncAt < freshFor * 60) return { status: 'skipped', reason: 'FRESH' };
  }
  return null;
}

/**
 * Another account is signed in. Only "Perbarui" (always) and a new sesskey
 * (once per 10 minutes) may check, with a batch that holds the session call
 * and nothing else. Its answer decides: previous account back, still the
 * same other account, or a third one. No user data is read or written.
 */
async function checkWhilePending(deps: SyncDeps, current: UserId, pending: AccountPending, now: UnixSeconds): Promise<SyncOutcome> {
  if (!mayCheckWhilePending(pending, deps.trigger, now)) return { status: 'skipped', reason: 'ACCOUNT_MISMATCH' };
  const result = await deps.client.callBatch([calls.sessionTimeRemaining()], { source: deps.trigger });
  if (result.kind !== 'ok') return transportOutcome(result);
  const session = parseCall('core_session_time_remaining', result.results[0] ?? missing);
  if (!session.ok) return { status: 'parser_broken', where: 'core_session_time_remaining' };

  const check = resolveCheck(current, pending, session.data.userid, now);
  if (check.kind === 'restored') {
    await deps.store.remove(ACCOUNT_PENDING_KEY);
    await writeSession(deps.store, deps.clock, 'OK', current);
    return { status: 'account_restored' };
  }
  await deps.store.set(ACCOUNT_PENDING_KEY, check.next);
  return { status: 'account_mismatch', userId: check.next.userId };
}

async function courseListState(deps: SyncDeps, now: UnixSeconds): Promise<{ due: boolean; missing: boolean }> {
  const userId = await currentUser(deps.store);
  if (userId === null) return { due: true, missing: true };
  const meta = await readUser(deps.store, userId, 'sync');
  if (meta.lastCourseListAt === null) return { due: true, missing: true };
  return { due: deps.forceCourseList === true || now - meta.lastCourseListAt >= COURSE_LIST_MIN_GAP_H * 3600, missing: false };
}

async function syncOnce(deps: SyncDeps, now: UnixSeconds): Promise<SyncOutcome> {
  const budget = await readBudget(deps.store, deps.clock);
  const mode = syncMode(deps.trigger, budget.used);
  const courseList = await courseListState(deps, now);
  // Radar (M4): notifications and course structures by mode, in the same batch: still one request per cycle.
  const knownUser = await currentUser(deps.store);
  const plan = planBatch({
    now,
    // Saver mode keeps the course list only when there is none yet.
    courseListDue: mode === 'saver' ? false : courseList.due,
    courseListMissing: courseList.missing,
    radar: await planRadarCalls(
      deps.store,
      knownUser,
      knownUser === null ? [] : await readUser(deps.store, knownUser, 'courses'),
      now,
      mode,
      knownUser === null ? [] : await readUser(deps.store, knownUser, 'tasks'),
    ),
    userId: knownUser,
    remaining: remainingQuota(budget),
  });
  const result = await deps.client.callBatch(plan.calls, { source: deps.trigger, withCourseList: plan.withCourseList });
  if (result.kind !== 'ok') {
    stage(deps, 'tasks', 'failed');
    return transportOutcome(result);
  }
  return applyBatch(deps, now, { knownUser, mode, plan }, result.results, { followUp: true, recap: true });
}

/** What a batch's answer is read against: who was known before it, the radar mode, and the plan it was sent with. */
export interface BatchContext {
  knownUser: UserId | null;
  mode: RadarMode;
  plan: Pick<BatchPlan, 'withCourseList' | 'radar' | 'radarStart'>;
}

/**
 * Everything after a batch's answer arrived: the session and account check,
 * tasks, courses, the radar, and the sync meta. Shared by a sync and by the
 * phone's background answers read later (watch/queue.ts), which pass
 * followUp and recap false: no follow-up batch and no attendance recap,
 * since those would be new requests. The budget is never touched here.
 */
export async function applyBatch(deps: Pick<SyncDeps, 'store' | 'clock' | 'origin'> & Partial<Pick<SyncDeps, 'client' | 'trigger' | 'onStage'>>, now: UnixSeconds, ctx: BatchContext, results: readonly CallResult[], options: { followUp: boolean; recap: boolean }): Promise<SyncOutcome> {
  const { knownUser, mode } = ctx;
  const { withCourseList, radar: radarPlan, radarStart } = ctx.plan;
  const [sessionResult, calendarResult, allResult, inProgressResult] = results;
  const radarResults = results.slice(radarStart);
  const session = parseCall('core_session_time_remaining', sessionResult ?? missing);
  if (!session.ok) return { status: 'parser_broken', where: 'core_session_time_remaining' };
  const userId: UserId = session.data.userid;
  // Another account than the stored one: hide, do not wipe. Nothing from
  // this batch is written; the user decides in the popup (lib/account).
  if (knownUser !== null && knownUser !== userId) {
    await deps.store.set(ACCOUNT_PENDING_KEY, newPending(userId, now));
    return { status: 'account_mismatch', userId };
  }
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
  stage(deps, 'tasks', calendar.ok ? 'ok' : 'failed');

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
  // Known courses count as found when the list was not due this time.
  stage(deps, 'courses', withCourseList && !courseListFetched ? 'failed' : 'ok');

  // The radar only reads results for the user it planned for (a different
  // account was just wiped by switchUser and starts with its own baseline).
  if (knownUser === userId) {
    // The radar never stops the tasks: an unexpected error is recorded for
    // the diagnosis (name only) and the sync goes on.
    try {
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
    } catch (e) {
      const meta = await readUser(deps.store, userId, 'radar');
      await writeUser(deps.store, userId, 'radar', { ...meta, lastRun: { at: now, planned: radarPlan.courseIds.length, stored: 0, errors: {}, notifications: 'skipped', failure: `exception:${e instanceof Error ? e.name : 'Error'}` } });
    }
  }

  // An account's first radar pass: its courses were only known from this
  // batch (first sync, or an account just switched to), so the plan had no
  // course structures. One follow-up batch now gives every course a
  // baseline right away instead of a sync or more later; it runs once,
  // since afterwards courses have check times.
  let followUp: Awaited<ReturnType<typeof firstSyncRadar>> = 'skipped';
  const neverChecked = Object.keys((await readUser(deps.store, userId, 'radar')).stateCheckedAt).length === 0;
  if (options.followUp && deps.client && deps.trigger && (knownUser !== userId || (neverChecked && radarPlan.courseIds.length === 0 && activeCourseIds(courses).size > 0))) {
    followUp = await firstSyncRadar(deps as SyncDeps, userId, courses, previousTasks, calendarMerged ? tasks : null, now, mode).catch(async (e: unknown) => {
      const meta = await readUser(deps.store, userId, 'radar');
      await writeUser(deps.store, userId, 'radar', { ...meta, lastRun: { at: now, planned: 0, stored: 0, errors: {}, notifications: 'skipped', failure: `first_sync:${e instanceof Error ? e.name : 'Error'}` } });
      return 'skipped' as const;
    });
  }
  const meta = await readUser(deps.store, userId, 'sync');
  await writeUser(deps.store, userId, 'sync', {
    lastSyncAt: broken.length === 0 ? now : meta.lastSyncAt,
    lastCourseListAt: courseListFetched ? now : meta.lastCourseListAt,
  });

  // Attendance recap (M7.3, owner's rule of 18 Nov 2026): a separate GET
  // after the main batch, in an account's first sync and then at most once
  // per 24 hours; skipped in saver mode. Its failure never fails the sync.
  // Not after a follow-up batch that saw another account or no session: the
  // recap page carries no account to check.
  if (options.recap && deps.client && deps.trigger && mode !== 'saver' && (followUp === 'ok' || followUp === 'skipped')) {
    const recap = await autoRecap(deps as SyncDeps, userId, courses, now, knownUser !== userId).catch(() => 'failed' as const);
    stage(deps, 'attendance', recap);
  }

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

/** The radar's follow-up batch in an account's first sync (see syncOnce). */
async function firstSyncRadar(deps: SyncDeps, userId: UserId, courses: readonly CourseRecord[], previousTasks: readonly Task[], nextTasks: readonly Task[] | null, now: UnixSeconds, mode: RadarMode): Promise<'ok' | 'mismatch' | 'unverified' | 'skipped'> {
  const planned = await planRadarCalls(deps.store, userId, courses, now, mode === 'full' ? 'normal' : mode, nextTasks ?? previousTasks);
  const plan = planBatch({ now, courseListDue: false, courseListMissing: false, radar: planned, userId, remaining: remainingQuota(await readBudget(deps.store, deps.clock)) }).radar;
  if (plan.calls.length === 0) {
    const meta = await readUser(deps.store, userId, 'radar');
    await writeUser(deps.store, userId, 'radar', { ...meta, lastRun: { at: now, planned: 0, stored: 0, errors: {}, notifications: 'skipped', failure: mode === 'saver' ? 'saver' : 'nothing_to_check' } });
    return 'skipped';
  }
  // Every batch carries the session call: it alone may end the session.
  const result = await deps.client.callBatch([calls.sessionTimeRemaining(), ...plan.calls], { source: deps.trigger });
  if (result.kind !== 'ok') {
    // Retried by the next sync, which plans the radar normally.
    const meta = await readUser(deps.store, userId, 'radar');
    await writeUser(deps.store, userId, 'radar', { ...meta, lastRun: { at: now, planned: plan.courseIds.length, stored: 0, errors: {}, notifications: 'skipped', failure: `first_sync:${result.kind}` } });
    return 'skipped';
  }
  // The session may have changed since the main batch: write nothing unless
  // this batch answers for the same account (a switch is left to the popup).
  const session = parseCall('core_session_time_remaining', result.results[0] ?? missing);
  if (!session.ok) return 'unverified';
  if (session.data.userid !== userId) {
    await deps.store.set(ACCOUNT_PENDING_KEY, newPending(session.data.userid, now));
    return 'mismatch';
  }
  await applyRadarResults(deps.store, { userId, now, origin: deps.origin ?? SIKOLA_ORIGIN, plan, results: result.results.slice(1), previousTasks, nextTasks });
  return 'ok';
}

/** The attendance recap when due (presensi/service.ts refreshRecap). */
async function autoRecap(deps: SyncDeps, userId: UserId, courses: readonly CourseRecord[], now: UnixSeconds, firstForAccount: boolean): Promise<'ok' | 'failed'> {
  const data = await readPresensi(deps.store, userId);
  if (data.recap !== null && now - data.recap.fetchedAt < PRESENSI_CACHE_SEC) return 'ok';
  const out = await refreshRecap(
    { client: deps.client, store: deps.store, clock: deps.clock, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, userId, monitored: activeCourseIds(courses) },
    // A course structure to find the activity only in the first sync, at most one; otherwise the radar's structures or a known cmid, else tomorrow.
    { force: false, maxProbes: firstForAccount ? 1 : 0 },
  );
  // No attendance activity anywhere is an answer, not a failure.
  return out.status === 'ok' || out.status === 'fresh' || out.status === 'no_attendance' || out.status === 'not_monitored' ? 'ok' : 'failed';
}
