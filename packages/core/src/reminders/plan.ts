// Reminder planner. Pure: given stored data and the time, it returns what to
// send now, which keys to record as sent, and when to wake up next. The
// background keeps exactly one rolling alarm at `nextAt` and runs this again
// on every wake-up and every relevant storage change (docs/ARCHITECTURE.md
// section 9). No request to SIKOLA is ever needed.

import { calendarDaysBetween } from '../format/time';
import { getTaskState, type TaskStateMap } from '../tasks/local-state';
import { categoryOf, DEFAULT_UPDATES, type UpdateSettings } from '../radar/settings';
import type { ChangeLogEntry, CourseId, SessionState, Task, UnixSeconds } from '../types';
import { calendarReminders, type CalendarEventLite, type CalendarStage } from '../calendar/notify';
import type { CalendarNotifySettings } from '../calendar/notify-settings';
import { lastStage, type ReminderSettings } from './settings';
import { morningCounts, pendingForMorning, type MorningCounts } from './morning';
import { classesToday } from '../neosia/today';
import { addDays, inWindow, localParts, nextLocalTime, windowEnd, zonedToUnix } from './zoned';

/** The morning summary is skipped when the browser opens more than this after its time. */
export const MORNING_GRACE = 3 * 3600;
/** Session notices: at most one per this long, and only for data at least this old (M7.2). */
export const SESSION_REPEAT_AFTER = 24 * 3600;
/** A session notice only once the last good data is older than this; fresher data gets the on-screen notice only. */
export const SESSION_NOTIFY_DATA_AGE = 24 * 3600;

export type SentKeys = Readonly<Record<string, UnixSeconds>>;

export interface PlanInput {
  now: UnixSeconds;
  timeZone: string;
  tasks: readonly Task[];
  taskState: TaskStateMap;
  activeCourseIds: ReadonlySet<CourseId>;
  settings: ReminderSettings;
  sent: SentKeys;
  /**
   * dataAt: the last good sync (the data on screen). An expired session
   * notifies only once that data is older than 24 hours. Task, calendar and
   * KRS reminders keep running from that data whatever the session state.
   */
  session: { state: SessionState; expiredAt: UnixSeconds | null; dataAt?: UnixSeconds | null };
  /**
   * The phone (owner's decision of 26 Nov 2026, mobile rule 7): "Masuk lagi" rides in the morning
   * summary, at most once a day, and never as a notice of its own. `relogin` names the other sources
   * whose session ended (Sipakamase, NEOSIA); SIKOLA's comes from `session`.
   */
  sessionInMorning?: boolean;
  relogin?: readonly string[];
  /** Change log (M4); entries with notify set and not yet sent become update notices. */
  changes?: readonly ChangeLogEntry[];
  updates?: UpdateSettings;
  /**
   * NEOSIA KRS windows (M7): reminders 3 days and 1 day before each one's
   * last day, the change window included. Present only while the module is
   * on and the KRS calendar reminders are on.
   */
  krsWindows?: readonly { start: string; end: string; caption: string | null }[];
  /**
   * NEOSIA nudges (M7.1, module on only): academic-calendar periods when a
   * NEOSIA page is worth opening. "grades": grade input or appeal periods;
   * "krs": a KRS window opening. One notification per period.
   */
  nudges?: readonly { id: string; nudge: 'grades' | 'krs'; mulai: string; selesai: string }[];
  /** "full" (the phone): overdue, today, tomorrow and today's events, nothing sent when all are empty; else the extension's summary. */
  morningStyle?: 'classic' | 'full';
  /**
   * NEOSIA's weekly schedule for the full summary's "Kuliah hari ini" line
   * (module on, schedule stored): names and times only, and the holidays
   * on which there is no class.
   */
  classes?: { meetings: readonly { name: string; weekday: number; start: string; end: string }[]; holidays: readonly { mulai: string; selesai: string; nama: string }[] };
  /** Academic calendar reminders (M5a); omitted means none. */
  calendar?: { events: readonly CalendarEventLite[]; settings: CalendarNotifySettings; /** Short source for the body, e.g. "SK Rektor No. 08429/UN4.1/KEP/2026". */ source: string };
}

export type Notice =
  /** One task: its stage reminder or its snooze reminder. */
  | { kind: 'task'; key: string; task: Task; snoozed: boolean }
  /** Several reminders at once (missed while the browser was closed, or held by quiet hours). */
  | { kind: 'summary'; key: string; count: number; nearest: Task }
  | { kind: 'morning'; key: string; today: number; week: number; nearest: Task; full?: MorningCounts; relogin?: readonly string[] }
  | { kind: 'session'; key: string; repeat: boolean }
  /** Updates for one course in one cycle ("3 materi baru di Hidrologi"). */
  | { kind: 'changes'; key: string; courseId: CourseId | null; entries: ChangeLogEntry[] }
  /** Updates across more than 3 courses, or held by quiet hours. */
  | { kind: 'changes_summary'; key: string; count: number; courses: number }
  /** An academic calendar date: a week or a day before it, or before a window's last day. */
  | { kind: 'calendar'; key: string; stage: CalendarStage; event: CalendarEventLite; source: string }
  /** The KRS window from NEOSIA closes in 3 days or tomorrow. */
  | { kind: 'krs'; key: string; stage: 'h3' | 'h1'; end: string; caption: string | null }
  /** Open a NEOSIA page so Sulo's copy is fresh: grades may be out, or KRS opened. */
  | { kind: 'nudge'; key: string; nudge: 'grades' | 'krs' };

export interface Plan {
  send: Notice[];
  /** Every key to record before showing anything (including stages folded into a summary). */
  markSent: string[];
  /** Next wake-up for the rolling alarm; null when nothing is pending. */
  nextAt: UnixSeconds | null;
}

/** Updates notify in groups of at most this many courses; more becomes one summary. */
export const MAX_COURSE_NOTICES = 3;
export const changeKey = (entry: ChangeLogEntry) => `c:${entry.id}`;

/**
 * Update notices. Quiet hours apply in full (no exception): during them
 * nothing is sent, and whatever was held goes out as one summary when they
 * end. Disabled kinds are recorded as handled, so turning them on later does
 * not replay old updates.
 */
function planChanges(input: PlanInput): { send: Notice[]; mark: string[]; nextAt: UnixSeconds | null } {
  const settings = input.updates ?? DEFAULT_UPDATES;
  const pending = (input.changes ?? []).filter((e) => e.notify && !(changeKey(e) in input.sent));
  if (pending.length === 0) return { send: [], mark: [], nextAt: null };
  const allowed = pending.filter((e) => {
    const category = categoryOf(e.change);
    return category !== null && settings[category];
  });
  const disabled = pending.filter((e) => !allowed.includes(e)).map(changeKey);
  if (allowed.length === 0) return { send: [], mark: disabled, nextAt: null };

  const { quiet } = input.settings;
  if (quiet.enabled && inWindow(input.now, quiet, input.timeZone)) {
    return { send: [], mark: disabled, nextAt: windowEnd(input.now, quiet, input.timeZone) };
  }
  const held = quiet.enabled && allowed.some((e) => inWindow(e.at, quiet, input.timeZone));
  const groups = new Map<CourseId | null, ChangeLogEntry[]>();
  for (const e of allowed) groups.set(e.change.courseId, [...(groups.get(e.change.courseId) ?? []), e]);
  const mark = [...disabled, ...allowed.map(changeKey)];
  if (held || groups.size > MAX_COURSE_NOTICES) {
    return { send: [{ kind: 'changes_summary', key: `chs:${input.now}`, count: allowed.length, courses: groups.size }], mark, nextAt: null };
  }
  const send: Notice[] = [...groups.entries()].map(([courseId, entries]) => ({
    kind: 'changes',
    key: entries.length === 1 ? entries[0]!.id : `chg:${courseId ?? 'x'}:${input.now}`,
    courseId,
    entries,
  }));
  return { send, mark, nextAt: null };
}

/**
 * Academic calendar reminders, at the user's morning time on their day
 * (quiet hours move them later that day). Sent only on their own day; one
 * whose day has passed is recorded as handled without a notification.
 */
function planCalendar(input: PlanInput): { send: Notice[]; mark: string[]; nextAt: UnixSeconds | null } {
  if (!input.calendar) return { send: [], mark: [], nextAt: null };
  const today = localParts(input.now, input.timeZone).dateKey;
  const atMin = input.settings.snoozeMorningMin;
  const send: Notice[] = [];
  const mark: string[] = [];
  const upcoming: UnixSeconds[] = [];
  for (const r of calendarReminders(input.calendar.events, input.calendar.settings)) {
    if (r.key in input.sent) continue;
    // NEOSIA's own KRS closing reminder replaces the calendar's "ends tomorrow".
    if ((input.krsWindows ?? []).length > 0 && r.kind === 'krs' && r.stage === 'h1-akhir') {
      mark.push(r.key);
      continue;
    }
    if (r.day < today) {
      mark.push(r.key);
      continue;
    }
    const fireAt = quietAdjusted(zonedToUnix(r.day, atMin, input.timeZone), false, input);
    if (r.day === today && fireAt <= input.now) {
      const releaseAt = quietAdjusted(input.now, false, input);
      if (releaseAt > input.now) upcoming.push(releaseAt);
      else {
        send.push({ kind: 'calendar', key: r.key, stage: r.stage, event: r.event, source: input.calendar.source });
        mark.push(r.key);
      }
    } else {
      upcoming.push(fireAt);
    }
  }
  const later = upcoming.filter((t) => t > input.now);
  return { send, mark, nextAt: later.length ? Math.min(...later) : null };
}

export const krsKey = (w: { start: string; end: string }, stage: 'h3' | 'h1') => `krs:${w.start}:${w.end}:${stage}`;

/**
 * KRS closing reminders, like calendar reminders: at the morning time on
 * their own day, moved past quiet hours, never sent late. One pair per window.
 */
function planKrs(input: PlanInput): { send: Notice[]; mark: string[]; nextAt: UnixSeconds | null } {
  const windows = input.krsWindows ?? [];
  if (windows.length === 0) return { send: [], mark: [], nextAt: null };
  const today = localParts(input.now, input.timeZone).dateKey;
  const atMin = input.settings.snoozeMorningMin;
  const send: Notice[] = [];
  const mark: string[] = [];
  const upcoming: UnixSeconds[] = [];
  for (const w of windows) {
    for (const [stage, days] of [['h3', 3], ['h1', 1]] as const) {
      const key = krsKey(w, stage);
      if (key in input.sent) continue;
      const day = addDays(w.end, -days);
      // A window shorter than the lead time has no such reminder.
      if (day < today || day < addDays(w.start, -1)) {
        mark.push(key);
        continue;
      }
      const fireAt = quietAdjusted(zonedToUnix(day, atMin, input.timeZone), false, input);
      if (day === today && fireAt <= input.now) {
        const releaseAt = quietAdjusted(input.now, false, input);
        if (releaseAt > input.now) upcoming.push(releaseAt);
        else {
          send.push({ kind: 'krs', key, stage, end: w.end, caption: w.caption });
          mark.push(key);
        }
      } else upcoming.push(fireAt);
    }
  }
  const later = upcoming.filter((t) => t > input.now);
  return { send, mark, nextAt: later.length ? Math.min(...later) : null };
}

export const nudgeKey = (n: { id: string; nudge: 'grades' | 'krs' }) => `nudge:${n.nudge}:${n.id}`;

/**
 * One nudge per period, on a day inside it: from the morning time of its
 * first day (later days send it right away), moved past quiet hours. A
 * period that already ended is recorded as handled.
 */
function planNudges(input: PlanInput): { send: Notice[]; mark: string[]; nextAt: UnixSeconds | null } {
  const nudges = input.nudges ?? [];
  if (nudges.length === 0) return { send: [], mark: [], nextAt: null };
  const today = localParts(input.now, input.timeZone).dateKey;
  const send: Notice[] = [];
  const mark: string[] = [];
  const upcoming: UnixSeconds[] = [];
  for (const n of nudges) {
    const key = nudgeKey(n);
    if (key in input.sent) continue;
    if (n.selesai < today) {
      mark.push(key);
      continue;
    }
    const first = n.mulai > today ? n.mulai : today;
    const at = quietAdjusted(Math.max(zonedToUnix(first, input.settings.snoozeMorningMin, input.timeZone), n.mulai > today ? 0 : input.now), false, input);
    if (n.mulai <= today && at <= input.now) {
      send.push({ kind: 'nudge', key, nudge: n.nudge });
      mark.push(key);
    } else upcoming.push(at);
  }
  const later = upcoming.filter((t) => t > input.now);
  return { send, mark, nextAt: later.length ? Math.min(...later) : null };
}

export const stageKey = (t: Task, stageMin: number) => `t:${t.eventId}:${stageMin}:${t.dueAt}`;
export const snoozeKey = (t: Task, until: UnixSeconds) => `t:${t.eventId}:snooze:${until}`;

interface Candidate {
  key: string;
  task: Task;
  /** When it should fire, after quiet hours. */
  at: UnixSeconds;
  snoozed: boolean;
  /** Keys that this candidate replaces when it fires (stages held back by a snooze). */
  covers: string[];
}

/** Tasks that may still be reminded: dated, not yet due, not done, still listed, active course. */
export function remindable(input: Pick<PlanInput, 'tasks' | 'taskState' | 'activeCourseIds' | 'now'>): Task[] {
  return input.tasks.filter(
    (t) =>
      t.dueAt !== null &&
      t.dueAt > input.now &&
      t.missingSince === null &&
      input.activeCourseIds.has(t.courseId) &&
      !getTaskState(input.taskState, t.eventId).doneManually,
  );
}

function quietAdjusted(at: UnixSeconds, exempt: boolean, input: PlanInput): UnixSeconds {
  const { quiet } = input.settings;
  if (!quiet.enabled || exempt) return at;
  return windowEnd(at, quiet, input.timeZone);
}

function taskCandidates(task: Task, input: PlanInput): Candidate[] {
  const dueAt = task.dueAt as UnixSeconds;
  const last = lastStage(input.settings);
  const exemptLast = input.settings.lastStageDuringQuiet;
  const snoozedUntil = getTaskState(input.taskState, task.eventId).snoozedUntil;
  const snoozeActive = snoozedUntil !== null && snoozedUntil < dueAt;

  const stages = input.settings.stages.map((s) => ({ key: stageKey(task, s), fireAt: dueAt - s * 60, stage: s }));
  // A snooze holds back every stage up to its time; they are recorded as sent
  // together with the snooze reminder, so they never fire afterwards.
  const held = snoozeActive ? stages.filter((s) => s.fireAt <= (snoozedUntil as UnixSeconds)) : [];
  const out: Candidate[] = stages
    .filter((s) => !held.includes(s) && !(s.key in input.sent))
    .map((s) => ({
      key: s.key,
      task,
      at: quietAdjusted(s.fireAt, exemptLast && s.stage === last, input),
      snoozed: false,
      covers: [],
    }));
  if (snoozeActive) {
    const key = snoozeKey(task, snoozedUntil as UnixSeconds);
    if (!(key in input.sent)) {
      out.push({ key, task, at: quietAdjusted(snoozedUntil as UnixSeconds, false, input), snoozed: true, covers: held.map((h) => h.key) });
    } else {
      // Snooze already delivered: the stages it held stay silent.
      return out;
    }
  }
  return out;
}

/**
 * "Masuk lagi ke SIKOLA" (M7.2): no earlier than the expiry, and only once
 * the data on screen is older than 24 hours (fresher data: the dashboard
 * and popup notice is enough). At most one per 24 hours, counted from the
 * last session notice actually sent, and never in quiet hours. Two per
 * expiry at most: the first, and one 24 hours later.
 */
function sessionCandidates(input: PlanInput): { key: string; at: UnixSeconds; repeat: boolean }[] {
  const { state, expiredAt } = input.session;
  if (state !== 'EXPIRED' || expiredAt === null) return [];
  // The phone (sessionInMorning): with the morning summary on, the offer rides in it; with it off, one notice
  // per ended session and never a repeat (mobile rule 7, owner's decision of 26 Nov 2026).
  const morningOn = input.settings.enabled && input.settings.morning.enabled;
  if (input.sessionInMorning && morningOn) return [];
  const dataAt = input.session.dataAt ?? null;
  const lastSent = Math.max(0, ...Object.entries(input.sent).filter(([k]) => k.startsWith('s:')).map(([, v]) => v));
  const spaced = (at: UnixSeconds) => Math.max(at, lastSent > 0 ? lastSent + SESSION_REPEAT_AFTER : 0);
  const firstKey = `s:${expiredAt}`;
  const first = Math.max(expiredAt, dataAt === null ? 0 : dataAt + SESSION_NOTIFY_DATA_AGE);
  const candidates = !(firstKey in input.sent)
    ? [{ key: firstKey, at: spaced(first), repeat: false }]
    : [{ key: `${firstKey}:24h`, at: spaced(first), repeat: true }].filter((c) => !(c.key in input.sent));
  return candidates.filter((c) => !(input.sessionInMorning && c.repeat)).map((c) => ({ ...c, at: quietAdjusted(c.at, false, input) }));
}

function morning(input: PlanInput, tasks: readonly Task[]): { notice: Notice | null; mark: string[]; nextAt: UnixSeconds | null } {
  const { morning: m } = input.settings;
  if (!input.settings.enabled || !m.enabled) return { notice: null, mark: [], nextAt: null };
  const today = localParts(input.now, input.timeZone).dateKey;
  // Quiet hours hold the summary too: a morning time inside the window moves to its end (Tahap 2).
  const todayAt = quietAdjusted(zonedToUnix(today, m.atMin, input.timeZone), false, input);
  const key = `m:${today}`;
  const nextAt = quietAdjusted(nextLocalTime(Math.max(input.now, todayAt), m.atMin, input.timeZone), false, input);
  if (input.now < todayAt || key in input.sent) return { notice: null, mark: [], nextAt: input.now < todayAt ? todayAt : nextAt };
  if (input.now - todayAt > MORNING_GRACE) return { notice: null, mark: [key], nextAt };
  // The phone: the sources whose session ended, offered in the summary (sessionInMorning).
  const ended = input.sessionInMorning
    ? [...(input.session.state === 'EXPIRED' && input.session.expiredAt !== null && input.now >= input.session.expiredAt ? ['SIKOLA'] : []), ...(input.relogin ?? [])]
    : [];
  const relogin = ended.length > 0 ? { relogin: ended } : {};
  if (input.morningStyle === 'full') {
    const pending = pendingForMorning(input.tasks, input.taskState, input.activeCourseIds);
    const todays = input.classes ? classesToday(input.classes.meetings, today, 0, input.classes.holidays).map((c) => ({ name: c.name, start: c.start })) : [];
    const full = morningCounts(input.now, input.timeZone, pending, input.calendar?.events ?? [], todays);
    const nearest = [...pending].sort((a, b) => (a.dueAt as number) - (b.dueAt as number))[0] ?? ({ name: '', dueAt: input.now } as Task);
    // Nothing overdue, due or on the calendar: no summary, the day handled; with an ended session, the offer alone.
    if (!full) return { notice: ended.length > 0 ? { kind: 'morning', key, today: 0, week: 0, nearest, ...relogin } : null, mark: [key], nextAt };
    return { notice: { kind: 'morning', key, today: full.today, week: full.today + full.tomorrow, nearest, full, ...relogin }, mark: [key], nextAt };
  }
  const dated = tasks.filter((t) => t.dueAt !== null).sort((a, b) => (a.dueAt as number) - (b.dueAt as number));
  const days = (t: Task) => calendarDaysBetween(input.now, t.dueAt as UnixSeconds, input.timeZone);
  const todayCount = dated.filter((t) => days(t) === 0).length;
  const weekCount = dated.filter((t) => days(t) < 7).length;
  const nearest = dated[0];
  // Nothing due this week: no summary, but the day counts as handled.
  if (!nearest || weekCount === 0) return { notice: null, mark: [key], nextAt };
  return { notice: { kind: 'morning', key, today: todayCount, week: weekCount, nearest }, mark: [key], nextAt };
}

export function planReminders(input: PlanInput): Plan {
  const { now } = input;
  const tasks = remindable(input);
  const send: Notice[] = [];
  const markSent: string[] = [];
  const upcoming: UnixSeconds[] = [];

  if (input.settings.enabled) {
    const due = new Map<number, Candidate[]>();
    for (const c of tasks.flatMap((t) => taskCandidates(t, input))) {
      // Due now, unless now is inside quiet hours and the reminder is not exempt.
      if (c.at <= now) {
        const exempt = !c.snoozed && input.settings.lastStageDuringQuiet && c.key === stageKey(c.task, lastStage(input.settings));
        const releaseAt = quietAdjusted(now, exempt, input);
        if (releaseAt > now) {
          upcoming.push(releaseAt);
          continue;
        }
        due.set(c.task.eventId, [...(due.get(c.task.eventId) ?? []), c]);
      } else {
        upcoming.push(c.at);
      }
    }

    // Per task, only the most recent due reminder speaks; older stages are folded in.
    const picks = [...due.values()].map((cs) => {
      const latest = cs.reduce((a, b) => (b.at > a.at ? b : a));
      markSent.push(...cs.flatMap((c) => [c.key, ...c.covers]));
      return latest;
    });
    if (picks.length === 1) {
      const p = picks[0]!;
      send.push({ kind: 'task', key: p.key, task: p.task, snoozed: p.snoozed });
    } else if (picks.length > 1) {
      const nearest = picks.map((p) => p.task).reduce((a, b) => ((b.dueAt as number) < (a.dueAt as number) ? b : a));
      send.push({ kind: 'summary', key: `sum:${now}`, count: picks.length, nearest });
    }

    const m = morning(input, tasks);
    if (m.notice) send.push(m.notice);
    markSent.push(...m.mark);
    if (m.nextAt !== null) upcoming.push(m.nextAt);
  }

  for (const s of sessionCandidates(input)) {
    if (s.at <= now) {
      // Only the most recent session reminder is shown; an older one is folded in.
      markSent.push(s.key);
      const existing = send.findIndex((n) => n.kind === 'session');
      const notice: Notice = { kind: 'session', key: s.key, repeat: s.repeat };
      if (existing >= 0) send[existing] = notice;
      else send.push(notice);
    } else {
      upcoming.push(s.at);
    }
  }

  const updates = planChanges(input);
  send.push(...updates.send);
  markSent.push(...updates.mark);
  if (updates.nextAt !== null) upcoming.push(updates.nextAt);

  const calendar = planCalendar(input);
  send.push(...calendar.send);
  markSent.push(...calendar.mark);
  if (calendar.nextAt !== null) upcoming.push(calendar.nextAt);

  const nudges = planNudges(input);
  send.push(...nudges.send);
  markSent.push(...nudges.mark);
  if (nudges.nextAt !== null) upcoming.push(nudges.nextAt);

  const krs = planKrs(input);
  send.push(...krs.send);
  markSent.push(...krs.mark);
  if (krs.nextAt !== null) upcoming.push(krs.nextAt);

  const later = upcoming.filter((t) => t > now);
  return { send, markSent: [...new Set(markSent)], nextAt: later.length ? Math.min(...later) : null };
}
