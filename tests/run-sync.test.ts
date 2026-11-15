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

function fakeClient(respond?: (calls: readonly MoodleCall[]) => BatchOutcome, userid = 1): FakeClient {
  const batches: FakeClient['batches'] = [];
  const all = fx('enrolled-courses.normal');
  const data = (c: MoodleCall): unknown => {
    switch (c.methodname) {
      case 'core_session_time_remaining':
        return { userid, timeremaining: 7200 };
      case 'core_calendar_get_action_events_by_timesort':
        return fx('calendar-action-events.normal');
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
    expect(client.batches[1]?.calls).toHaveLength(2);
    expect(client.batches[1]?.options).toEqual({ source: 'manual', withCourseList: false });
    await runSync({ client, store, clock: fixedClock('2026-09-23', 10, NOW + DAY), trigger: 'manual' });
    expect(client.batches[2]?.calls).toHaveLength(4);
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
          : { ok: true, data: { userid: 1, timeremaining: 1 } },
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
});
