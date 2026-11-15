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

  it('skips a popup sync when data is younger than 15 minutes, without a request', async () => {
    const client = fakeClient();
    const store = memoryStore();
    await run(client, store, 'onboarding');
    const outcome = await runSync({ client, store, clock: fixedClock('2026-09-22', 10, NOW + 10 * 60), trigger: 'popup' });
    expect(outcome).toEqual({ status: 'skipped', reason: 'FRESH' });
    expect(client.batches).toHaveLength(1);
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
    expect((store.dump()[SYNC_STATUS_KEY] as { lastOutcome: unknown; running: boolean })).toMatchObject({ lastOutcome: expected, running: false });
  });
});

describe('jitterMinutes', () => {
  it('picks once per installation and reuses it', async () => {
    const store = memoryStore();
    expect(await jitterMinutes(store, () => 0.55)).toBe(6);
    expect(await jitterMinutes(store, () => 0.99)).toBe(6);
    expect(store.dump()[JITTER_KEY]).toBe(6);
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
});
