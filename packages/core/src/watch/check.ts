// The reference of what the native watch worker does on one background
// check, as pure functions. The Kotlin worker (WatchCheck.kt) implements
// the same steps; both are tested on one shared file of vectors
// (watch/vectors.json), so CI fails when they disagree. Every rule and text
// comes from the plan (watch/plan.ts); nothing here is decided twice.
//
// One check: is it time and allowed (budget, backoff, stale plan) -> build
// the batch -> send (native) -> read the session result -> find what is new
// against the baseline -> group into notifications from the templates,
// holding them during quiet hours. Anything not understood: silent.

import type { BackoffState, BudgetState, UnixSeconds } from '../types';
import { PLAN_STALE_SEC, type WatchPlan, type WatchTemplate } from './plan';

/** Android notification id of a string key (the app's own numericId, apps/mobile/src/platform/notifications.ts). */
export function numericId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_000_000_000;
}

// ---- When --------------------------------------------------------------

export const isDay = (minuteOfDay: number, plan: Pick<WatchPlan, 'schedule'>): boolean => minuteOfDay >= plan.schedule.dayStartMin && minuteOfDay < plan.schedule.nightStartMin;

/** Same window rule as core's quiet hours (reminders/zoned.ts inWindow). */
export function inQuiet(minuteOfDay: number, quiet: WatchPlan['quiet']): boolean {
  if (!quiet.enabled || quiet.startMin === quiet.endMin) return false;
  return quiet.startMin < quiet.endMin ? minuteOfDay >= quiet.startMin && minuteOfDay < quiet.endMin : minuteOfDay >= quiet.startMin || minuteOfDay < quiet.endMin;
}

export interface CheckContext {
  minuteOfDay: number;
  /** Android's Battery Saver (PowerManager.isPowerSaveMode). */
  powerSave: boolean;
  /** POST requests used today (the shared budget). */
  usedToday: number;
}

/**
 * Minutes until the next check, or null: the hard limit is reached, no
 * check until the daily reset. Battery Saver: the night interval day and
 * night. Past the soft limit: daytime slows to softDayIntervalMin.
 */
export function nextDelayMinutes(plan: Pick<WatchPlan, 'schedule' | 'budget'>, ctx: CheckContext): number | null {
  if (ctx.usedToday >= plan.budget.hardPosts) return null;
  if (ctx.powerSave || !isDay(ctx.minuteOfDay, plan)) return plan.schedule.nightIntervalMin;
  return ctx.usedToday >= plan.budget.softPosts ? plan.schedule.softDayIntervalMin : plan.schedule.dayIntervalMin;
}

/** Radar rides on every radarEvery-th daytime check; never at night, in Battery Saver, or past the soft limit. */
export function radarDue(plan: Pick<WatchPlan, 'schedule' | 'budget'>, ctx: CheckContext, dayCheckIndex: number): boolean {
  if (ctx.powerSave || !isDay(ctx.minuteOfDay, plan) || ctx.usedToday >= plan.budget.softPosts) return false;
  return dayCheckIndex % plan.schedule.radarEvery === plan.schedule.radarEvery - 1;
}

/** The next courses in turn from a cursor; returns them and the cursor after. */
export function pickRadar(courseIds: readonly number[], cursor: number, max: number): { ids: number[]; cursor: number } {
  if (courseIds.length === 0 || max <= 0) return { ids: [], cursor: 0 };
  const n = Math.min(max, courseIds.length);
  const start = ((cursor % courseIds.length) + courseIds.length) % courseIds.length;
  const ids = Array.from({ length: n }, (_, i) => courseIds[(start + i) % courseIds.length]!);
  return { ids, cursor: (start + n) % courseIds.length };
}

export const planStale = (plan: Pick<WatchPlan, 'writtenAt'>, now: UnixSeconds): boolean => now - plan.writtenAt > PLAN_STALE_SEC;

// ---- Budget and backoff (the same JSON as core's global:budget and global:backoff) ----

/**
 * Reserve one POST with `calls` function calls, like core's reserveRequest
 * (moodle/budget.ts) with source "watch". `today` is the local date.
 */
export function reserve(state: BudgetState | null, today: string, now: UnixSeconds, calls: number, plan: Pick<WatchPlan, 'budget'>): { ok: boolean; next: BudgetState } {
  const b = plan.budget;
  const current: BudgetState = state && state.date === today ? state : { date: today, used: 0 };
  if (current.used >= b.hardPosts) return { ok: false, next: current };
  if (calls > 0 && (current.calls ?? 0) + calls > b.callLimit) return { ok: false, next: current };
  if (current.pausedUntil !== undefined && now < current.pausedUntil) return { ok: false, next: current };
  const recent = (current.recent ?? []).filter((t) => now - t < b.loopWindowSec);
  if (recent.length >= b.loopPosts) return { ok: false, next: { ...current, recent, pausedUntil: now + b.loopPauseSec } };
  return {
    ok: true,
    next: {
      date: current.date,
      used: current.used + 1,
      // "watch" is the phone worker's own source key; the extension never sees it.
      bySource: { ...current.bySource, watch: ((current.bySource as Record<string, number> | undefined)?.watch ?? 0) + 1 } as BudgetState['bySource'],
      withCourseList: current.withCourseList ?? 0,
      ...(calls > 0 || current.calls !== undefined ? { calls: (current.calls ?? 0) + calls } : {}),
      recent: [...recent, now],
    },
  };
}

const BACKOFF_STEPS_H = [3, 6, 12, 24];
const BACKOFF_MAX_H = 24;

export const backingOff = (s: BackoffState | null, now: UnixSeconds): boolean => s !== null && s.failures > 0 && now < s.nextAllowedAt;

/** Like core's afterFailure (moodle/backoff.ts): half to full step, Retry-After can only lengthen it, at most 24 h. */
export function afterFailure(prev: BackoffState | null, now: UnixSeconds, retryAfterSec: number | null, random: number): BackoffState {
  const failures = (prev?.failures ?? 0) + 1;
  const step = (BACKOFF_STEPS_H[failures - 1] ?? BACKOFF_MAX_H) * 3600;
  const r = Math.min(1, Math.max(0, random));
  const computed = Math.round(step * (0.5 + 0.5 * r));
  return { failures, nextAllowedAt: now + Math.min(Math.max(computed, retryAfterSec ?? 0), BACKOFF_MAX_H * 3600) };
}

// ---- The batch ---------------------------------------------------------

export function buildBatch(plan: Pick<WatchPlan, 'calls' | 'radar'>, now: UnixSeconds, radarIds: readonly number[]): { index: number; methodname: string; args: Record<string, unknown> }[] {
  const base = plan.calls.map((c) => ({ methodname: c.methodname, args: { ...c.args, ...Object.fromEntries(Object.entries(c.nowOffsets ?? {}).map(([k, off]) => [k, now + off])) } }));
  const radar = radarIds.map((id) => ({ methodname: plan.radar.methodname, args: { [plan.radar.argKey]: id } }));
  return [...base, ...radar].map((c, index) => ({ index, ...c }));
}

// ---- Reading the answer ------------------------------------------------

export type Detected =
  | { kind: 'task_added'; key: string; courseId: number | null; eventId: number; cmId: number | null; name: string }
  | { kind: 'due_changed'; key: string; courseId: number | null; eventId: number; name: string }
  | { kind: 'grade_feedback' | 'forum'; key: string; courseId: number | null; notificationId: number }
  | { kind: 'material' | 'task_activity'; key: string; courseId: number; cmId: number; name: string };

/** What the worker learned since the plan was written, so a change is never announced twice before the app opens. */
export interface Overlay {
  eventIds: number[];
  dueKeys: string[];
  notificationLastId: number | null;
  cms: Record<string, number[]>;
}

export const emptyOverlay = (): Overlay => ({ eventIds: [], dueKeys: [], notificationLastId: null, cms: {} });

export type CheckOutcome = { status: 'expired' } | { status: 'unsure' } | { status: 'ok'; changes: Detected[]; overlay: Overlay };

type Json = Record<string, unknown>;
const obj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const int = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

function cmIdFromUrl(url: unknown): number | null {
  if (typeof url !== 'string') return null;
  const m = /^https?:\/\/[^/]+\/mod\/[^?#]*\?(?:[^#]*&)?id=(\d+)(?:[&#]|$)/.exec(url);
  const id = m ? Number(m[1]) : NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}

function courseFromCustomdata(raw: unknown): number | null {
  if (typeof raw !== 'string' || raw === '') return null;
  try {
    const d = JSON.parse(raw) as unknown;
    const v = obj(d) ? d.courseid : undefined;
    const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

const sessionEnded = (r: unknown): boolean => {
  if (!obj(r) || r.error !== true || !obj(r.exception)) return false;
  return r.exception.errorcode === 'servicerequireslogin' || r.exception.errorcode === 'requireloginerror';
};

/**
 * Compares one answer (Moodle's result array, in batch order) with the
 * plan's baseline and the overlay. Any result whose shape is not the
 * expected one makes the whole check "unsure": no notification.
 */
export function detect(plan: WatchPlan, overlay: Overlay, now: UnixSeconds, results: unknown, radarIds: readonly number[]): CheckOutcome {
  if (!Array.isArray(results) || results.length !== plan.calls.length + radarIds.length) return { status: 'unsure' };
  if (sessionEnded(results[0])) return { status: 'expired' };
  if (!results.every((r) => obj(r) && r.error === false)) return { status: 'unsure' };
  const data = results.map((r) => (r as Json).data);

  const session = data[0];
  if (!obj(session) || !int(session.userid) || session.userid !== plan.userId) return { status: 'unsure' };

  const changes: Detected[] = [];
  const next: Overlay = { eventIds: [...overlay.eventIds], dueKeys: [...overlay.dueKeys], notificationLastId: overlay.notificationLastId, cms: Object.fromEntries(Object.entries(overlay.cms).map(([k, v]) => [k, [...v]])) };

  // Calendar: new tasks and changed due dates.
  const calendar = data[1];
  if (!obj(calendar) || !Array.isArray(calendar.events)) return { status: 'unsure' };
  const known = new Map(plan.baseline.tasks.map((t) => [t.eventId, t]));
  const announced = new Set(plan.baseline.announcedCms);
  const newTaskCms = new Set<number>();
  for (const e of calendar.events) {
    if (!obj(e) || !int(e.id) || !int(e.timesort) || !obj(e.course) || !int(e.course.id) || typeof e.name !== 'string') return { status: 'unsure' };
    const name = (typeof e.activityname === 'string' && e.activityname.trim() !== '' ? e.activityname.trim() : e.name).trim();
    const cmId = cmIdFromUrl(e.url) ?? (obj(e.action) ? cmIdFromUrl(e.action.url) : null);
    const dueAt = e.timesort > 0 ? e.timesort : null;
    if (!plan.baseline.tasksReady) continue;
    const before = known.get(e.id);
    if (!before) {
      if (next.eventIds.includes(e.id)) continue;
      next.eventIds.push(e.id);
      if (cmId !== null) newTaskCms.add(cmId);
      if (dueAt !== null && dueAt - now > plan.farTaskSec) continue;
      if (cmId !== null && announced.has(cmId)) continue;
      changes.push({ kind: 'task_added', key: `task:${e.id}:added`, courseId: e.course.id, eventId: e.id, cmId, name });
    } else if (before.dueAt !== dueAt) {
      const key = `task:${e.id}:due:${dueAt ?? 'none'}`;
      if (next.dueKeys.includes(key)) continue;
      next.dueKeys.push(key);
      changes.push({ kind: 'due_changed', key, courseId: e.course.id, eventId: e.id, name });
    }
  }

  // Popup notifications: grades and forum by component/eventtype, never by subject.
  const notes = data[2];
  if (!obj(notes) || !Array.isArray(notes.notifications)) return { status: 'unsure' };
  const last = Math.max(plan.baseline.notificationLastId ?? -1, next.notificationLastId ?? -1);
  if (plan.baseline.notificationLastId !== null) {
    const fresh = [];
    for (const n of notes.notifications) {
      if (!obj(n) || !int(n.id) || typeof n.component !== 'string' || typeof n.eventtype !== 'string') return { status: 'unsure' };
      if (n.id > last) fresh.push(n);
    }
    fresh.sort((a, b) => (a.id as number) - (b.id as number));
    for (const n of fresh) {
      const rule = plan.notificationRules.find((r) => r.component === n.component && (r.eventtype === null || r.eventtype === n.eventtype));
      const kind = rule?.kind ?? 'other';
      next.notificationLastId = Math.max(next.notificationLastId ?? -1, n.id as number);
      if (kind === 'other') continue;
      changes.push({ kind, key: `note:${n.id}`, courseId: courseFromCustomdata(n.customdata), notificationId: n.id as number });
    }
  }

  // Course structures: new visible activities against the course's known ones.
  for (let i = 0; i < radarIds.length; i++) {
    const courseId = radarIds[i]!;
    const raw = data[plan.calls.length + i];
    if (typeof raw !== 'string') return { status: 'unsure' };
    let state: unknown;
    try {
      state = JSON.parse(raw);
    } catch {
      return { status: 'unsure' };
    }
    if (!obj(state) || !Array.isArray(state.cm)) return { status: 'unsure' };
    const baseline = plan.baseline.courseCms[String(courseId)];
    if (!baseline) continue; // no snapshot yet: core takes the baseline when the app opens
    const seen = new Set([...baseline, ...(next.cms[String(courseId)] ?? [])]);
    for (const cm of state.cm) {
      if (!obj(cm) || !int(cm.id) || typeof cm.module !== 'string' || typeof cm.name !== 'string') return { status: 'unsure' };
      if (seen.has(cm.id)) continue;
      seen.add(cm.id);
      next.cms[String(courseId)] = [...(next.cms[String(courseId)] ?? []), cm.id];
      const visible = cm.visible !== false && cm.uservisible !== false;
      if (cm.module === 'label' || !visible) continue;
      // The same activity as a new task in this answer: the task is the news.
      if (newTaskCms.has(cm.id) || plan.baseline.tasks.some((t) => t.cmId === cm.id)) continue;
      const kind = plan.taskModules.includes(cm.module) ? 'task_activity' : 'material';
      changes.push({ kind, key: `cm:${courseId}:${cm.id}:added`, courseId, cmId: cm.id, name: cm.name });
    }
  }

  return { status: 'ok', changes: changes.filter((c) => allowed(plan, c)), overlay: next };
}

/** "Beri tahu saya tentang": materials (new tasks and material), deadlines, grades, forum. */
function allowed(plan: WatchPlan, c: Detected): boolean {
  switch (c.kind) {
    case 'task_added':
    case 'material':
    case 'task_activity':
      return plan.notify.materials;
    case 'due_changed':
      return plan.notify.deadlines;
    case 'grade_feedback':
      return plan.notify.grades;
    case 'forum':
      return plan.notify.forum;
  }
}

// ---- Notifications -----------------------------------------------------

export interface WatchNotice {
  /** The app's notification id string (reminders/run.ts notificationId shapes), for taps and dedupe. */
  id: string;
  numericId: number;
  title: string;
  body: string;
}

const fill = (t: WatchTemplate, values: Record<string, string>): WatchTemplate => {
  const sub = (s: string) => s.replace(/\{(name|course|n|courses)\}/g, (_, k: string) => values[k] ?? '');
  return { title: sub(t.title).trim(), body: sub(t.body).trim() };
};

const NAME_MAX = 60;
const shorten = (s: string) => (s.length > NAME_MAX ? `${s.slice(0, NAME_MAX - 1).trimEnd()}…` : s);

function single(plan: WatchPlan, c: Detected, course: string): WatchTemplate {
  const t = plan.templates;
  switch (c.kind) {
    case 'task_added':
    case 'task_activity':
      return fill(t.taskAdded, { name: shorten(c.name), course });
    case 'due_changed':
      return fill(t.dueChanged, { name: shorten(c.name), course });
    case 'grade_feedback':
      return fill(t.grade, { course });
    case 'forum':
      return fill(t.forum, { course });
    case 'material':
      return fill(t.material, { name: shorten(c.name), course });
  }
}

/**
 * The notifications for `changes` (this check plus any held ones). Quiet
 * hours: nothing now, everything held. Outside them: one per course (one
 * change: its own text; several: "{n} hal baru di {course}"), or one
 * summary when they span more than maxCourseNotices courses or were held.
 */
export function notices(plan: WatchPlan, changes: readonly Detected[], held: readonly Detected[], now: UnixSeconds, minuteOfDay: number): { send: WatchNotice[]; hold: Detected[] } {
  const all = [...held, ...changes];
  if (all.length === 0) return { send: [], hold: [] };
  if (inQuiet(minuteOfDay, plan.quiet)) return { send: [], hold: all };
  const groups = new Map<number | null, Detected[]>();
  for (const c of all) groups.set(c.courseId, [...(groups.get(c.courseId) ?? []), c]);
  const courseName = (id: number | null) => (id === null ? plan.templates.otherCourse : (plan.courseNames[String(id)] ?? plan.templates.otherCourse));
  if (held.length > 0 || groups.size > plan.maxCourseNotices) {
    const t = fill(plan.templates.summary, { n: String(all.length), courses: String(groups.size) });
    const id = `changes_summary|chs:${now}`;
    return { send: [{ id, numericId: numericId(id), ...t }], hold: [] };
  }
  const send = [...groups.entries()].map(([courseId, cs]): WatchNotice => {
    const course = courseName(courseId);
    const t = cs.length === 1 ? single(plan, cs[0]!, course) : fill(plan.templates.mixed, { n: String(cs.length), course });
    const id = cs.length === 1 ? `changes|${cs[0]!.key}` : `changes|course:${courseId ?? 'x'}|chg:${courseId ?? 'x'}:${now}`;
    return { id, numericId: numericId(id), ...t };
  });
  return { send, hold: [] };
}
