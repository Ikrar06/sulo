import { describe, expect, it } from 'vitest';
import { planReminders, snoozeKey, stageKey, type PlanInput, type SentKeys } from '../lib/reminders/plan';
import { DEFAULT_REMINDERS, type ReminderSettings } from '../lib/reminders/settings';
import { localParts, nextLocalTime, zonedToUnix } from '../lib/reminders/zoned';
import { setDone, setSnooze } from '../lib/tasks/local-state';
import type { Task } from '../lib/types';

const TZ = 'Asia/Makassar';
const H = 3600;
const at = (y: number, mo: number, d: number, h: number, mi = 0) => Date.UTC(y, mo - 1, d, h - 8, mi) / 1000; // WITA wall time

const task = (eventId: number, dueAt: number | null, patch: Partial<Task> = {}): Task => ({
  eventId, cmId: null, courseId: 1, name: `Tugas ${eventId}`, module: 'assign', dueAt, url: `https://x/${eventId}`,
  overdue: false, firstSeenAt: 0, lastSeenAt: 0, missingSince: null, ...patch,
});

const base = (now: number, tasks: Task[], patch: Partial<PlanInput> = {}): PlanInput => ({
  now, timeZone: TZ, tasks, taskState: {}, activeCourseIds: new Set([1]), settings: DEFAULT_REMINDERS, sent: {},
  session: { state: 'OK', expiredAt: null }, ...patch,
});

/** Runs the planner like the background does: send, record, wake at nextAt. */
function simulate(from: number, to: number, input: Omit<PlanInput, 'now' | 'sent'>, wakeups: number[] = []) {
  let sent: SentKeys = {};
  let now = from;
  const log: { now: number; kinds: string[]; keys: string[] }[] = [];
  const extra = [...wakeups].sort((a, b) => a - b);
  for (let i = 0; i < 200 && now <= to; i++) {
    const plan = planReminders({ ...input, now, sent });
    if (plan.send.length) log.push({ now, kinds: plan.send.map((n) => n.kind), keys: plan.send.map((n) => n.key) });
    sent = { ...sent, ...Object.fromEntries(plan.markSent.map((k) => [k, now])) };
    const nextExtra = extra.find((w) => w > now);
    const next = [plan.nextAt, nextExtra].filter((x): x is number => x !== null && x !== undefined);
    if (!next.length) break;
    now = Math.min(...next);
  }
  return { log, sent };
}

describe('zoned time', () => {
  it('converts local wall time both ways', () => {
    const t = zonedToUnix('2026-11-19', 23 * 60 + 59, TZ);
    expect(t).toBe(at(2026, 11, 19, 23, 59));
    expect(localParts(t, TZ)).toEqual({ dateKey: '2026-11-19', minuteOfDay: 23 * 60 + 59 });
  });

  it('finds the next local time across midnight and in another zone', () => {
    expect(nextLocalTime(at(2026, 11, 19, 23, 0), 7 * 60, TZ)).toBe(at(2026, 11, 20, 7, 0));
    expect(nextLocalTime(Date.UTC(2026, 10, 19, 12) / 1000, 7 * 60, 'Asia/Jakarta')).toBe(Date.UTC(2026, 10, 20, 0) / 1000);
  });
});

describe('reminder stages', () => {
  const due = at(2026, 11, 19, 15, 0); // Thursday 15.00
  const t = task(10, due);

  it('fires 3 days, 1 day and 3 hours before, each once', () => {
    const { log } = simulate(at(2026, 11, 15, 12), due + H, base(0, [t]));
    expect(log.map((l) => l.now)).toEqual([due - 72 * H, due - 24 * H, due - 3 * H]);
    expect(log.flatMap((l) => l.keys)).toEqual([stageKey(t, 4320), stageKey(t, 1440), stageKey(t, 180)]);
  });

  it('wakes up for the nearest reminder only (one rolling alarm)', () => {
    expect(planReminders(base(at(2026, 11, 15, 12), [t])).nextAt).toBe(due - 72 * H);
  });

  it('never sends a key twice, however often the worker wakes up', () => {
    const wakeups = Array.from({ length: 60 }, (_, i) => due - 80 * H + i * 1.5 * H);
    const { log } = simulate(due - 80 * H, due, base(0, [t]), wakeups);
    const keys = log.flatMap((l) => l.keys);
    expect(keys).toHaveLength(new Set(keys).size);
    expect(keys).toHaveLength(3);
  });

  it('recomputes from a changed due date and skips stages already past', () => {
    const now = due - 72 * H + 60;
    const first = planReminders(base(now, [t]));
    const sent = Object.fromEntries(first.markSent.map((k) => [k, now]));
    // The lecturer moves the deadline 2 days earlier: 1 day before is now past.
    const moved = task(10, due - 48 * H);
    const plan = planReminders(base(now + 60, [moved], { sent }));
    expect(plan.send).toEqual([{ kind: 'task', key: stageKey(moved, 1440), task: moved, snoozed: false }]);
    expect(plan.nextAt).toBe(moved.dueAt! - 3 * H);
  });

  it('skips done, missing, overdue, undated and inactive-course tasks', () => {
    const now = due - 3 * H;
    const tasks = [
      task(1, due),
      task(2, due, { missingSince: now - H }),
      task(3, now - 60),
      task(4, null),
      task(5, due, { courseId: 99 }),
    ];
    const plan = planReminders(base(now, tasks, { taskState: setDone({}, 1, true) }));
    expect(plan.send).toEqual([]);
    expect(plan.nextAt).toBeNull();
  });

  it('follows the chosen stages', () => {
    const settings: ReminderSettings = { ...DEFAULT_REMINDERS, stages: [360, 60] };
    const { log } = simulate(due - 10 * H, due, base(0, [t], { settings }));
    expect(log.map((l) => l.now)).toEqual([due - 6 * H, due - H]);
  });

  it('sends nothing when reminders are off', () => {
    const plan = planReminders(base(due - 3 * H, [t], { settings: { ...DEFAULT_REMINDERS, enabled: false } }));
    expect(plan.send).toEqual([]);
  });
});

describe('quiet hours (22.00 to 06.00)', () => {
  it('holds a reminder until quiet hours end, across midnight', () => {
    const due = at(2026, 11, 21, 23, 0); // 1 day before = Friday 23.00, inside quiet hours
    const t = task(20, due);
    const plan = planReminders(base(at(2026, 11, 20, 21, 0), [t], { sent: { [stageKey(t, 4320)]: 1 } }));
    expect(plan.nextAt).toBe(at(2026, 11, 21, 6, 0));
    const atEnd = planReminders(base(at(2026, 11, 21, 6, 0), [t], { sent: { [stageKey(t, 4320)]: 1 } }));
    expect(atEnd.send.map((n) => n.key)).toEqual([stageKey(t, 1440)]);
  });

  it('still sends the last reminder (3 hours) at night for a 23.59 deadline', () => {
    const t = task(21, at(2026, 11, 19, 23, 59));
    const plan = planReminders(base(at(2026, 11, 19, 20, 59), [t], { sent: { [stageKey(t, 4320)]: 1, [stageKey(t, 1440)]: 1 } }));
    expect(plan.send.map((n) => n.key)).toEqual([stageKey(t, 180)]);
  });

  it('holds the last reminder too when the exception is turned off', () => {
    const t = task(22, at(2026, 11, 20, 1, 0)); // 3 hours before = 22.00
    const settings = { ...DEFAULT_REMINDERS, lastStageDuringQuiet: false };
    const plan = planReminders(base(at(2026, 11, 19, 22, 0), [t], { settings, sent: { [stageKey(t, 4320)]: 1, [stageKey(t, 1440)]: 1 } }));
    expect(plan.send).toEqual([]);
    expect(plan.nextAt).toBe(at(2026, 11, 20, 6, 0));
  });

  it('merges reminders held overnight into one summary', () => {
    const a = task(23, at(2026, 11, 21, 23, 0)); // 1 day before: Fri 23.00
    const b = task(24, at(2026, 11, 22, 1, 0)); // 1 day before: Sat 01.00
    const sent = { [stageKey(a, 4320)]: 1, [stageKey(b, 4320)]: 1 };
    const plan = planReminders(base(at(2026, 11, 21, 6, 0), [a, b], { sent }));
    expect(plan.send).toEqual([{ kind: 'summary', key: `sum:${at(2026, 11, 21, 6, 0)}`, count: 2, nearest: a }]);
    expect(plan.markSent).toEqual(expect.arrayContaining([stageKey(a, 1440), stageKey(b, 1440)]));
  });

  it('keeps quiet hours fully off when disabled', () => {
    const t = task(25, at(2026, 11, 21, 23, 0));
    const settings = { ...DEFAULT_REMINDERS, quiet: { ...DEFAULT_REMINDERS.quiet, enabled: false } };
    const plan = planReminders(base(at(2026, 11, 20, 23, 0), [t], { settings, sent: { [stageKey(t, 4320)]: 1 } }));
    expect(plan.send.map((n) => n.key)).toEqual([stageKey(t, 1440)]);
  });
});

describe('missed while the browser was closed', () => {
  it('sends one summary instead of a burst, with the nearest task', () => {
    const a = task(30, at(2026, 11, 20, 15, 0));
    const b = task(31, at(2026, 11, 20, 18, 0));
    const c = task(32, at(2026, 11, 21, 9, 0));
    const reopened = at(2026, 11, 20, 10, 0); // everything up to 1 day before is overdue
    const plan = planReminders(base(reopened, [a, b, c]));
    expect(plan.send).toEqual([{ kind: 'summary', key: `sum:${reopened}`, count: 3, nearest: a }]);
    // Every older stage is folded in, so none fires afterwards.
    expect(plan.markSent).toEqual(expect.arrayContaining([stageKey(a, 4320), stageKey(a, 1440), stageKey(b, 4320), stageKey(c, 1440)]));
  });

  it('turns a stale early stage into the current one for a single task', () => {
    const t = task(33, at(2026, 11, 20, 12, 0));
    const plan = planReminders(base(at(2026, 11, 20, 10, 0), [t])); // 2 hours left; 3-day stage long past
    expect(plan.send).toEqual([{ kind: 'task', key: stageKey(t, 180), task: t, snoozed: false }]);
    expect(plan.markSent).toEqual(expect.arrayContaining([stageKey(t, 4320), stageKey(t, 1440), stageKey(t, 180)]));
  });
});

describe('snooze', () => {
  const due = at(2026, 11, 20, 18, 0); // daytime, outside quiet hours
  const t = task(40, due);

  it('moves the reminder and keeps the held stages silent afterwards', () => {
    const now = due - 24 * H; // the 1-day reminder fires, the user snoozes 1 hour
    const sent = { [stageKey(t, 4320)]: 1, [stageKey(t, 1440)]: now };
    const taskState = setSnooze({}, 40, now + H);
    expect(planReminders(base(now + 60, [t], { taskState, sent })).nextAt).toBe(now + H);
    const plan = planReminders(base(now + H, [t], { taskState, sent }));
    expect(plan.send).toEqual([{ kind: 'task', key: snoozeKey(t, now + H), task: t, snoozed: true }]);
    const after = { ...sent, ...Object.fromEntries(plan.markSent.map((k) => [k, now + H])) };
    expect(planReminders(base(now + 2 * H, [t], { taskState, sent: after })).send).toEqual([]);
  });

  it('holds back a stage that falls inside the snooze', () => {
    const now = due - 4 * H; // 14.00
    const taskState = setSnooze({}, 40, now + 3 * H); // 17.00, past the 3-hour stage (15.00)
    const sent = { [stageKey(t, 4320)]: 1, [stageKey(t, 1440)]: 1 };
    const atStage = planReminders(base(due - 3 * H, [t], { taskState, sent }));
    expect(atStage.send).toEqual([]);
    expect(atStage.nextAt).toBe(now + 3 * H);
    const atSnooze = planReminders(base(now + 3 * H, [t], { taskState, sent }));
    expect(atSnooze.send.map((n) => n.key)).toEqual([snoozeKey(t, now + 3 * H)]);
    expect(atSnooze.markSent).toContain(stageKey(t, 180));
  });

  it('a snooze that lands in quiet hours waits until they end', () => {
    const late = task(41, at(2026, 11, 21, 12, 0));
    const taskState = setSnooze({}, 41, at(2026, 11, 20, 23, 0));
    const plan = planReminders(base(at(2026, 11, 20, 22, 30), [late], { taskState, sent: { [stageKey(late, 4320)]: 1 } }));
    expect(plan.nextAt).toBe(at(2026, 11, 21, 6, 0));
  });
});

describe('time zone and date changes', () => {
  it('uses local wall time of the given zone for quiet hours', () => {
    const t = task(50, Date.UTC(2026, 10, 21, 15, 0) / 1000);
    const fire = t.dueAt! - 24 * H; // Fri 15.00 UTC = 23.00 WITA but 22.00 WIB, 06.00 Sat in JST? no: 00.00 JST
    const sent = { [stageKey(t, 4320)]: 1 };
    const wita = planReminders(base(fire, [t], { sent }));
    const utc = planReminders(base(fire, [t], { sent, timeZone: 'UTC' }));
    expect(wita.send).toEqual([]); // 23.00 WITA: quiet
    expect(utc.send.map((n) => n.key)).toEqual([stageKey(t, 1440)]); // 15.00 UTC: not quiet
  });

  it('a laptop that changes zone mid-schedule only shifts quiet-hour releases', () => {
    const t = task(51, at(2026, 11, 21, 23, 0));
    const sent = { [stageKey(t, 4320)]: 1 };
    const inWita = planReminders(base(at(2026, 11, 20, 23, 30), [t], { sent }));
    const inJakarta = planReminders(base(at(2026, 11, 20, 23, 30), [t], { sent, timeZone: 'Asia/Jakarta' }));
    expect(inWita.nextAt).toBe(at(2026, 11, 21, 6, 0));
    expect(inJakarta.nextAt).toBe(at(2026, 11, 21, 7, 0)); // 06.00 WIB = 07.00 WITA
  });
});

describe('service worker waking up mid-schedule', () => {
  it('a restart between stages sends nothing new and points at the next stage', () => {
    const due = at(2026, 11, 19, 15, 0);
    const t = task(60, due);
    const sent = { [stageKey(t, 4320)]: due - 72 * H };
    const plan = planReminders(base(due - 30 * H, [t], { sent }));
    expect(plan.send).toEqual([]);
    expect(plan.nextAt).toBe(due - 24 * H);
  });
});

describe('morning summary', () => {
  const settings: ReminderSettings = { ...DEFAULT_REMINDERS, morning: { enabled: true, atMin: 7 * 60 } };
  const today = task(70, at(2026, 11, 19, 23, 59));
  const later = task(71, at(2026, 11, 22, 12, 0));

  it('sends once at the chosen time with today, this week and the nearest task', () => {
    const now = at(2026, 11, 19, 7, 0);
    const sent = { [stageKey(today, 4320)]: 1, [stageKey(today, 1440)]: 1, [stageKey(later, 4320)]: 1 };
    const plan = planReminders(base(now, [today, later], { settings, sent }));
    expect(plan.send).toContainEqual({ kind: 'morning', key: 'm:2026-11-19', today: 1, week: 2, nearest: today });
    const again = planReminders(base(now + 60, [today, later], { settings, sent: { ...sent, 'm:2026-11-19': now } }));
    expect(again.send.find((n) => n.kind === 'morning')).toBeUndefined();
  });

  it('is skipped without tasks this week and when the browser opens much later', () => {
    expect(planReminders(base(at(2026, 11, 19, 7, 0), [], { settings })).send).toEqual([]);
    const late = planReminders(base(at(2026, 11, 19, 15, 0), [today], { settings, sent: { [stageKey(today, 4320)]: 1, [stageKey(today, 1440)]: 1 } }));
    expect(late.send.find((n) => n.kind === 'morning')).toBeUndefined();
  });

  it('is off by default', () => {
    expect(planReminders(base(at(2026, 11, 19, 7, 0), [today])).send.find((n) => n.kind === 'morning')).toBeUndefined();
  });
});

describe('session expired (M7.2)', () => {
  const expiredAt = at(2026, 11, 19, 10, 0);
  const stale = expiredAt - 30 * H; // data older than 24 hours when the session ends
  const session = { state: 'EXPIRED' as const, expiredAt, dataAt: stale };

  it('old data: one notice at expiry, one more 24 hours later, never more', () => {
    const { log } = simulate(expiredAt, expiredAt + 96 * H, base(0, [], { session }), [expiredAt + 2 * H, expiredAt + 30 * H, expiredAt + 60 * H]);
    expect(log.map((l) => l.keys)).toEqual([[`s:${expiredAt}`], [`s:${expiredAt}:24h`]]);
    expect(log[1]!.now - log[0]!.now).toBeGreaterThanOrEqual(24 * H);
  });

  it('fresh data: no notification until the data is 24 hours old', () => {
    const fresh = { ...session, dataAt: expiredAt - 2 * H };
    expect(planReminders(base(expiredAt, [], { session: fresh })).send).toEqual([]);
    expect(planReminders(base(expiredAt, [], { session: fresh })).nextAt).toBe(expiredAt + 22 * H);
    const { log } = simulate(expiredAt, expiredAt + 30 * H, base(0, [], { session: fresh }));
    expect(log.map((l) => [l.now, l.keys])).toEqual([[expiredAt + 22 * H, [`s:${expiredAt}`]]]);
  });

  it('at most one per 24 hours, also across expiries', () => {
    const sent = { [`s:${expiredAt - H}`]: expiredAt - H };
    const plan = planReminders(base(expiredAt, [], { session, sent }));
    expect(plan.send).toEqual([]);
    expect(plan.nextAt).toBe(expiredAt + 23 * H);
  });

  it('never in quiet hours: moved to their end', () => {
    const night = at(2026, 11, 19, 23, 0);
    const settings = { ...DEFAULT_REMINDERS, quiet: { ...DEFAULT_REMINDERS.quiet, enabled: true } };
    const plan = planReminders(base(night, [], { settings, session: { state: 'EXPIRED', expiredAt: night, dataAt: stale } }));
    expect(plan.send).toEqual([]);
    expect(localParts(plan.nextAt!, TZ).minuteOfDay).toBe(settings.quiet.endMin);
  });

  it('sends nothing once the session is back', () => {
    expect(planReminders(base(expiredAt + H, [], { session: { state: 'OK', expiredAt: null } })).send).toEqual([]);
  });

  it('keeps reminding about deadlines while the session is expired', () => {
    const t = task(80, expiredAt + 3 * H);
    const plan = planReminders(base(expiredAt, [t], { session, sent: { [`s:${expiredAt}`]: expiredAt } }));
    expect(plan.send.map((n) => n.kind)).toEqual(['task']);
  });

  it('expired for 3 days: the H-1 reminder still comes, from the last data', () => {
    const due = expiredAt + 4 * 24 * H;
    const t = task(81, due);
    const { log } = simulate(expiredAt, due, base(0, [t], { session }));
    const h1 = log.find((l) => l.keys.includes(stageKey(t, 1440)));
    expect(h1?.now).toBe(due - 24 * H);
    expect(h1!.now - expiredAt).toBe(3 * 24 * H);
  });
});
