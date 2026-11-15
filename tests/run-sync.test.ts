import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MoodleCall } from '../lib/moodle/calls';
import type { BatchOutcome, MoodleClient, RequestOptions } from '../lib/moodle/client';
import { SESSION_KEY } from '../lib/moodle/session';
import { jitterMinutes, JITTER_KEY } from '../lib/schedule';
import { readUser, switchUser, SYNC_STATUS_KEY, writeUser } from '../lib/storage';
import { runSync } from '../lib/sync/run-sync';
import type { SyncTrigger } from '../lib/types';
import { fixedClock, memoryStore } from './helpers';

const fx = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/synthetic/${name}.json`, import.meta.url), 'utf8'));
const NOW = 1_790_000_000;
const DAY = 86_400;

interface FakeClient extends MoodleClient {
  batches: { calls: MoodleCall[]; options: RequestOptions | undefined }[];
}

function fakeClient(
  respond?: (calls: readonly MoodleCall[]) => BatchOutcome,
  userid = 1,
  notifications: () => unknown = () => fx('popup-notifications.normal'),
  state: (courseId: number) => unknown = () => fx('courseformat-state.normal'),
): FakeClient {
  const batches: FakeClient['batches'] = [];
  const all = fx('enrolled-courses.normal');
  const data = (c: MoodleCall): unknown => {
    switch (c.methodname) {
      case 'core_session_time_remaining':
        return { userid, timeremaining: 7200 };
      case 'core_calendar_get_action_events_by_timesort':
        return fx('calendar-action-events.normal');
      case 'message_popup_get_popup_notifications':
        return notifications();
      case 'core_courseformat_get_state':
        return state(c.args.courseid as number);
      case 'core_course_get_enrolled_courses_by_timeline_classification':
        return c.args.classification === 'inprogress'
          ? { courses: all.courses.filter((x: { id: number }) => [401, 402, 403].includes(x.id)), nextoffset: 3 }
          : all;
      default:
        return null;
    }
  };
  return {
    batches,
    async callBatch(callList, options) {
      batches.push({ calls: [...callList], options });
      return respond ? respond(callList) : { kind: 'ok', results: callList.map((c) => ({ ok: true, data: data(c) })) };
    },
    async fetchPage() {
      return { kind: 'network_error' };
    },
  };
}

const run = (client: MoodleClient, store = memoryStore(), trigger: SyncTrigger = 'manual', hour = 10, idle: 'active' | 'idle' = 'active') =>
  runSync({ client, store, clock: fixedClock('2026-09-22', hour, NOW), trigger, idleState: idle });

describe('runSync', () => {
  it('sends one batch with session and calendar, plus the course list on first run', async () => {
    const client = fakeClient();
    const store = memoryStore();
    const outcome = await run(client, store, 'onboarding');
    expect(client.batches).toHaveLength(1);
    expect(client.batches[0]?.calls.map((c) => `${c.methodname}:${String(c.args.classification ?? '')}`)).toEqual([
      'core_session_time_remaining:',
      'core_calendar_get_action_events_by_timesort:',
      'core_course_get_enrolled_courses_by_timeline_classification:all',
      'core_course_get_enrolled_courses_by_timeline_classification:inprogress',
    ]);
    expect(client.batches[0]?.options).toEqual({ source: 'onboarding', withCourseList: true });
    expect(outcome).toEqual({ status: 'ok', at: NOW, tasks: 3, courseListFetched: true });

    const courses = await readUser(store, 1, 'courses');
    expect(courses.filter((c) => c.inProgress).map((c) => c.id)).toEqual([401, 402, 403]);
    expect(courses.find((c) => c.id === 401)?.parsed.code).toBe('23D01110101');
    expect((await readUser(store, 1, 'sync')).lastSyncAt).toBe(NOW);
    expect((store.dump()[SESSION_KEY] as { state: string; userId: number })).toMatchObject({ state: 'OK', userId: 1 });
  });

  it('fetches the course list at most once a day', async () => {
    const client = fakeClient();
    const store = memoryStore();
    await run(client, store, 'onboarding');
    await runSync({ client, store, clock: fixedClock('2026-09-22', 14, NOW + 4 * 3600), trigger: 'manual' });
    const courseListCalls = (i: number) => client.batches[i]?.calls.filter((c) => c.methodname === 'core_course_get_enrolled_courses_by_timeline_classification') ?? [];
    expect(courseListCalls(1)).toHaveLength(0);
    expect(client.batches[1]?.options).toEqual({ source: 'manual', withCourseList: false });
    await runSync({ client, store, clock: fixedClock('2026-09-23', 10, NOW + DAY), trigger: 'manual' });
    expect(courseListCalls(2)).toHaveLength(2);
  });

  // Replaces "skips a popup sync when data is younger than 15 minutes": the
  // popup no longer triggers a sync at all (Stage 1, item 7).
  describe('freshness per trigger (no request when data is fresh)', () => {
    const at = (minutes: number, hour = 10) => fixedClock('2026-09-22', hour, NOW + minutes * 60);
    const after = async (trigger: SyncTrigger, minutes: number) => {
      const client = fakeClient();
      const store = memoryStore();
      await run(client, store, 'onboarding');
      const outcome = await runSync({ client, store, clock: at(minutes), trigger, idleState: 'active' });
      return { outcome, requests: client.batches.length - 1 };
    };

    it('background waits out the 3-hour TTL (with 10 minutes of slack for alarm timing)', async () => {
      expect(await after('background', 120)).toEqual({ outcome: { status: 'skipped', reason: 'FRESH' }, requests: 0 });
      expect((await after('background', 171)).requests).toBe(1);
    });

    it('startup and idle catch-ups run only when data is older than 60 minutes', async () => {
      for (const trigger of ['startup', 'idle'] as const) {
        expect(await after(trigger, 45)).toEqual({ outcome: { status: 'skipped', reason: 'FRESH' }, requests: 0 });
        expect((await after(trigger, 61)).requests).toBe(1);
      }
    });

    it('catch-ups obey quiet hours and idle like the background', async () => {
      const client = fakeClient();
      expect(await runSync({ client, store: memoryStore(), clock: fixedClock('2026-09-22', 2, NOW), trigger: 'startup', idleState: 'active' })).toEqual({ status: 'skipped', reason: 'QUIET_HOURS' });
      expect(await runSync({ client, store: memoryStore(), clock: fixedClock('2026-09-22', 10, NOW), trigger: 'idle', idleState: 'locked' })).toEqual({ status: 'skipped', reason: 'IDLE' });
      expect(client.batches).toHaveLength(0);
    });

    it('setup reuses data younger than 5 minutes, but only when a course list exists', async () => {
      expect(await after('onboarding', 3)).toEqual({ outcome: { status: 'skipped', reason: 'FRESH' }, requests: 0 });
      expect((await after('onboarding', 6)).requests).toBe(1);
      const client = fakeClient();
      const store = memoryStore();
      await switchUser(store, 1);
      await writeUser(store, 1, 'sync', { lastSyncAt: NOW, lastCourseListAt: null });
      await runSync({ client, store, clock: at(1), trigger: 'onboarding' });
      expect(client.batches).toHaveLength(1);
    });

    it('a click on "Perbarui" always runs', async () => {
      expect((await after('manual', 1)).requests).toBe(1);
    });

    it('setup follows the 24-hour course list TTL too; "Segarkan daftar" forces it', async () => {
      const client = fakeClient();
      const store = memoryStore();
      await run(client, store, 'onboarding');
      const lists = (i: number) => client.batches[i]!.calls.filter((c) => c.methodname === 'core_course_get_enrolled_courses_by_timeline_classification').length;
      await runSync({ client, store, clock: at(30), trigger: 'onboarding' });
      expect(lists(1)).toBe(0);
      await runSync({ client, store, clock: at(60), trigger: 'onboarding', forceCourseList: true });
      expect(lists(2)).toBe(2);
    });
  });

  it('never runs in the background during quiet hours or while idle', async () => {
    const client = fakeClient();
    expect(await run(client, memoryStore(), 'background', 3, 'active')).toEqual({ status: 'skipped', reason: 'QUIET_HOURS' });
    expect(await run(client, memoryStore(), 'background', 10, 'idle')).toEqual({ status: 'skipped', reason: 'IDLE' });
    expect(client.batches).toHaveLength(0);
  });

  it('wipes the previous account when another user signs in', async () => {
    const store = memoryStore();
    await switchUser(store, 99);
    await writeUser(store, 99, 'tasks', []);
    await run(fakeClient(undefined, 1), store, 'onboarding');
    expect(Object.keys(store.dump()).filter((k) => k.startsWith('u:99:'))).toEqual([]);
  });

  it('flags a semester review instead of changing the user choice', async () => {
    const store = memoryStore();
    await run(fakeClient(), store, 'onboarding');
    await writeUser(store, 1, 'onboarding', { completedAt: NOW, confirmedInProgress: [401, 402], reviewSuggested: [] });
    await runSync({ client: fakeClient(), store, clock: fixedClock('2026-09-23', 10, NOW + DAY), trigger: 'manual' });
    expect((await readUser(store, 1, 'onboarding')).reviewSuggested).toEqual([403]);
    expect((await readUser(store, 1, 'courses')).every((c) => c.activePin === null)).toBe(true);
  });

  it('keeps previous tasks and reports parser_broken when the calendar shape is wrong', async () => {
    const store = memoryStore();
    await run(fakeClient(), store, 'onboarding');
    const broken = fakeClient((calls) => ({
      kind: 'ok',
      results: calls.map((c) =>
        c.methodname === 'core_calendar_get_action_events_by_timesort'
          ? { ok: true, data: { events: 'nope' } }
          : c.methodname === 'core_session_time_remaining'
            ? { ok: true, data: { userid: 1, timeremaining: 1 } }
            : { ok: false, errorcode: 'nopermissions' },
      ),
    }));
    const outcome = await runSync({ client: broken, store, clock: fixedClock('2026-09-22', 11, NOW + 3600), trigger: 'manual' });
    expect(outcome).toEqual({ status: 'parser_broken', where: 'core_calendar_get_action_events_by_timesort' });
    expect(await readUser(store, 1, 'tasks')).toHaveLength(3);
    expect((await readUser(store, 1, 'sync')).lastSyncAt).toBe(NOW);
  });

  it.each([
    [{ kind: 'login_required' } as BatchOutcome, { status: 'session_expired' }],
    [{ kind: 'network_error' } as BatchOutcome, { status: 'offline' }],
    [{ kind: 'timeout' } as BatchOutcome, { status: 'server_error' }],
    [{ kind: 'refused', reason: 'BUDGET_EXHAUSTED' } as BatchOutcome, { status: 'skipped', reason: 'BUDGET_EXHAUSTED' }],
    [{ kind: 'invalid_sesskey' } as BatchOutcome, { status: 'invalid_sesskey' }],
  ])('maps %o', async (batch, expected) => {
    const store = memoryStore();
    expect(await run(fakeClient(() => batch), store)).toEqual(expected);
    expect((store.dump()[SYNC_STATUS_KEY] as { lastOutcome: unknown })).toMatchObject({ lastOutcome: expected });
  });
});

describe('jitterMinutes', () => {
  it('picks once per installation and reuses it', async () => {
    const store = memoryStore();
    // Range 0..20 minutes since Stage 1 (was 0..10): 0.55 -> 11.
    expect(await jitterMinutes(store, () => 0.55)).toBe(11);
    expect(await jitterMinutes(store, () => 0.99)).toBe(11);
    expect(store.dump()[JITTER_KEY]).toBe(11);
    expect(await jitterMinutes(memoryStore(), () => 0.999)).toBe(20);
  });

  describe('radar (M4)', () => {
    const state = (cms: { id: number; name: string; module?: string; visible?: boolean }[]) => {
      const base = fx('courseformat-state.normal');
      const parsed = JSON.parse(base as string);
      const tmpl = parsed.cm[0];
      parsed.cm = cms.map((c) => ({ ...tmpl, id: c.id, name: c.name, module: c.module ?? 'resource', visible: c.visible ?? true, uservisible: true }));
      parsed.section[0].cmlist = cms.map((c) => c.id);
      for (const s of parsed.section.slice(1)) s.cmlist = [];
      return JSON.stringify(parsed);
    };

    it('stays one request per cycle, with notifications and at most 5 course structures', async () => {
      const client = fakeClient();
      const store = memoryStore();
      await run(client, store, 'onboarding');
      await runSync({ client, store, clock: fixedClock('2026-09-22', 14, NOW + 4 * 3600), trigger: 'manual' });
      const second = client.batches[1]!.calls.map((c) => c.methodname);
      expect(client.batches).toHaveLength(2);
      expect(second.filter((m) => m === 'message_popup_get_popup_notifications')).toHaveLength(1);
      expect(second.filter((m) => m === 'core_courseformat_get_state').length).toBeLessThanOrEqual(5);
    });

    it('logs nothing on the baselines, then logs new material and new notifications', async () => {
      let cms = [{ id: 1, name: 'Modul 1' }];
      let notes = fx('popup-notifications.normal');
      const client = fakeClient(undefined, 1, () => notes, () => state(cms));
      const store = memoryStore();
      await run(client, store, 'onboarding'); // learns the user
      await runSync({ client, store, clock: fixedClock('2026-09-22', 11, NOW + 3600), trigger: 'manual' }); // radar baselines
      expect(await readUser(store, 1, 'changes')).toEqual([]);

      cms = [{ id: 1, name: 'Modul 1' }, { id: 2, name: 'Modul 2' }];
      notes = fx('popup-notifications.grades');
      await runSync({ client, store, clock: fixedClock('2026-09-22', 18, NOW + 8 * 3600), trigger: 'manual' });
      const kinds = (await readUser(store, 1, 'changes')).map((e) => e.change.kind);
      expect(kinds).toContain('added');
      expect(kinds).toContain('grade_feedback');
      expect(JSON.stringify(await readUser(store, 1, 'changes'))).not.toMatch(/fullmessage|Komentar dosen/);
    });

    it('never reads a failed course result as "everything removed"', async () => {
      let broken = false;
      const client = fakeClient(undefined, 1, () => fx('popup-notifications.normal'), () => (broken ? '{"oops":1}' : state([{ id: 1, name: 'Modul 1' }])));
      const store = memoryStore();
      await run(client, store, 'onboarding');
      await runSync({ client, store, clock: fixedClock('2026-09-22', 11, NOW + 3600), trigger: 'manual' });
      const before = await readUser(store, 1, 'snapshots');
      broken = true;
      const outcome = await runSync({ client, store, clock: fixedClock('2026-09-22', 18, NOW + 8 * 3600), trigger: 'manual' });
      expect(outcome).toMatchObject({ status: 'parser_broken', where: 'core_courseformat_get_state' });
      expect(await readUser(store, 1, 'snapshots')).toEqual(before);
      expect(await readUser(store, 1, 'changes')).toEqual([]);
    });
  });

  describe('course structure errors (by kind)', () => {
    const NOW2 = NOW + 3600;
    /** Answers everything normally, except get_state for the listed courses. */
    const withStateErrors = (errors: Record<number, string>) =>
      fakeClient((callList) => ({
        kind: 'ok',
        results: callList.map((c) => {
          if (c.methodname === 'core_courseformat_get_state') {
            const code = errors[c.args.courseid as number];
            return code ? { ok: false, errorcode: code } : { ok: true, data: fx('courseformat-state.normal') };
          }
          if (c.methodname === 'core_session_time_remaining') return { ok: true, data: { userid: 1, timeremaining: 7200 } };
          if (c.methodname === 'core_calendar_get_action_events_by_timesort') return { ok: true, data: fx('calendar-action-events.normal') };
          if (c.methodname === 'message_popup_get_popup_notifications') return { ok: true, data: fx('popup-notifications.normal') };
          return { ok: true, data: null };
        }),
      }));

    async function learned() {
      const store = memoryStore();
      await run(fakeClient(), store, 'onboarding');
      return store;
    }

    it('an access error skips that course for 24 hours and flags it after 3 in a row, without touching the session', async () => {
      const store = await learned();
      const client = withStateErrors({ 401: 'requireloginerror' });
      const outcome = await runSync({ client, store, clock: fixedClock('2026-09-22', 11, NOW2), trigger: 'manual' });
      expect(outcome.status).toBe('ok');
      expect((store.dump()[SESSION_KEY] as { state: string }).state).toBe('OK');
      expect((await readUser(store, 1, 'radar')).courseAccess?.['401']).toMatchObject({ failures: 1, flagged: false, lastErrorcode: 'requireloginerror' });
      expect((await readUser(store, 1, 'stats')).courseAccessFailures).toBe(1);

      // Within 24 hours the course is not asked again, even when 6 hours passed.
      await runSync({ client, store, clock: fixedClock('2026-09-22', 18, NOW2 + 7 * 3600), trigger: 'manual' });
      const asked = client.batches.at(-1)!.calls.filter((c) => c.methodname === 'core_courseformat_get_state').map((c) => c.args.courseid);
      expect(asked).not.toContain(401);

      // After 24 hours it is tried again; the third failure in a row flags it.
      await runSync({ client, store, clock: fixedClock('2026-09-23', 12, NOW2 + 25 * 3600), trigger: 'manual' });
      await runSync({ client, store, clock: fixedClock('2026-09-24', 13, NOW2 + 50 * 3600), trigger: 'manual' });
      expect((await readUser(store, 1, 'radar')).courseAccess?.['401']).toMatchObject({ failures: 3, flagged: true });
    });

    it('a server error is counted but retried at the next normal check and never flagged', async () => {
      const store = await learned();
      const client = withStateErrors({ 401: 'dmlreadexception' });
      await runSync({ client, store, clock: fixedClock('2026-09-22', 11, NOW2), trigger: 'manual' });
      expect((await readUser(store, 1, 'radar')).courseAccess?.['401']).toBeUndefined();
      expect((await readUser(store, 1, 'stats')).courseOtherFailures).toBe(1);
      await runSync({ client, store, clock: fixedClock('2026-09-22', 18, NOW2 + 6 * 3600 + 60), trigger: 'manual' });
      const asked = client.batches.at(-1)!.calls.filter((c) => c.methodname === 'core_courseformat_get_state').map((c) => c.args.courseid);
      expect(asked).toContain(401);
    });

    it('every structure failing with a server error counts as SIKOLA trouble (backoff), not per course', async () => {
      const store = await learned();
      const client = withStateErrors({ 401: 'dmlreadexception', 402: 'unknownerror', 403: 'generalexceptionmessage' });
      await runSync({ client, store, clock: fixedClock('2026-09-22', 11, NOW2), trigger: 'manual' });
      expect((store.dump()['global:backoff'] as { failures: number }).failures).toBe(1);
      expect((await readUser(store, 1, 'radar')).courseAccess ?? {}).toEqual({});
    });

    it('every sync batch carries the session call (it alone may end the session)', async () => {
      const client = fakeClient();
      const store = memoryStore();
      await run(client, store, 'onboarding');
      await runSync({ client, store, clock: fixedClock('2026-09-22', 14, NOW + 4 * 3600), trigger: 'manual' });
      for (const b of client.batches) expect(b.calls.map((c) => c.methodname)).toContain('core_session_time_remaining');
    });
  });
});
