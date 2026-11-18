import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MoodleCall } from '@sulo/core/moodle/calls';
import type { MoodleClient } from '@sulo/core/moodle/client';
import { readUser } from '@sulo/core/storage';
import { runSync } from '@sulo/core/sync/run-sync';
import { activeCourseIds } from '@sulo/core/courses/active-score';
import { pickCoursesToCheck } from '@sulo/core/radar/schedule';
import { RADAR_AUTO_MAX } from '@sulo/core/moodle/limits';
import { fixedClock, memoryStore } from './helpers';

const fx = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/synthetic/${name}.json`, import.meta.url), 'utf8'));
const NOW = 1_790_000_000;

function client(state: (courseId: number) => string) {
  const all = fx('enrolled-courses.normal');
  const batches: string[][] = [];
  const c: MoodleClient = {
    async callBatch(calls: readonly MoodleCall[]) {
      batches.push(calls.map((x) => x.methodname));
      return {
        kind: 'ok',
        results: calls.map((x) => ({
          ok: true,
          data:
            x.methodname === 'core_session_time_remaining' ? { userid: 1, timeremaining: 7200 }
            : x.methodname === 'core_calendar_get_action_events_by_timesort' ? fx('calendar-action-events.normal')
            : x.methodname === 'message_popup_get_popup_notifications' ? fx('popup-notifications.normal')
            : x.methodname === 'core_courseformat_get_state' ? state(x.args.courseid as number)
            : x.args.classification === 'inprogress' ? { courses: all.courses.filter((k: { id: number }) => [401, 402, 403].includes(k.id)), nextoffset: 3 } : all,
        })),
      };
    },
    async fetchPage() {
      return { kind: 'network_error' };
    },
  };
  return Object.assign(c, { batches });
}

describe('radar regression (M7.3 fix)', () => {
  it('after one manual sync every followed course has a structure snapshot', async () => {
    const store = memoryStore();
    const k = client(() => fx('courseformat-state.normal'));
    // First sync: account and course list (setup), second: "Perbarui".
    await runSync({ client: k, store, clock: fixedClock('2026-09-22', 10, NOW), trigger: 'onboarding' });
    await runSync({ client: k, store, clock: fixedClock('2026-09-22', 10, NOW + 600), trigger: 'manual' });
    const followed = activeCourseIds(await readUser(store, 1, 'courses'));
    const snapshots = await readUser(store, 1, 'snapshots');
    expect(followed.size).toBeGreaterThan(0);
    expect(Object.keys(snapshots).map(Number).sort()).toEqual([...followed].sort());
  });

  const withModule = (extra: boolean) => () => {
    const state = JSON.parse(fx('courseformat-state.normal')) as { cm: Record<string, unknown>[] };
    if (extra) state.cm.push({ ...state.cm[0], id: '999', name: 'Materi baru minggu ini', module: 'resource', modname: 'File' });
    return JSON.stringify(state);
  };

  it('the first structures are a baseline: no kabar; one new module later gives one kabar', async () => {
    const store = memoryStore();
    let extra = false;
    const k = client(() => withModule(extra)());
    await runSync({ client: k, store, clock: fixedClock('2026-09-22', 10, NOW), trigger: 'onboarding' });
    await runSync({ client: k, store, clock: fixedClock('2026-09-22', 10, NOW + 600), trigger: 'manual' });
    // Only structure entries count here (the calendar has its own baseline rule).
    const structure = (await readUser(store, 1, 'changes')).filter((e) => ['added', 'renamed', 'hidden', 'shown'].includes(e.change.kind));
    expect(structure).toEqual([]);
    const radar = await readUser(store, 1, 'radar');
    expect(radar.lastRun).toMatchObject({ planned: 3, stored: 3, errors: {} });
    // The module appears in one course only.
    extra = true;
    const only401 = client((id) => withModule(id === 401)());
    await runSync({ client: only401, store, clock: fixedClock('2026-09-22', 11, NOW + 3600), trigger: 'manual' });
    const entries = (await readUser(store, 1, 'changes')).filter((e) => 'courseId' in e.change && e.change.courseId === 401 && e.change.kind === 'added');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.change).toMatchObject({ kind: 'added', courseId: 401, cmId: 999, module: 'resource' });
  });

  it('automatic syncs check at most 4 courses per turn; "Perbarui" checks every followed course', () => {
    const ids = [1, 2, 3, 4, 5, 6, 7];
    expect(pickCoursesToCheck(ids, {}, NOW)).toHaveLength(RADAR_AUTO_MAX);
    expect(pickCoursesToCheck(ids, {}, NOW, { all: true, maxPerBatch: 10 })).toEqual(ids);
  });

  it('a radar error never stops the tasks, and is recorded for the diagnosis', async () => {
    const store = memoryStore();
    const k = client(() => fx('courseformat-state.normal'));
    await runSync({ client: k, store, clock: fixedClock('2026-09-22', 10, NOW), trigger: 'onboarding' });
    // A structure that passes validation but breaks the diff (items without names).
    const bad = client(() => JSON.stringify({ ...JSON.parse(fx('courseformat-state.normal')), cm: 'not a list' }));
    const outcome = await runSync({ client: bad, store, clock: fixedClock('2026-09-22', 10, NOW + 600), trigger: 'manual' });
    expect((await readUser(store, 1, 'tasks')).length).toBeGreaterThan(0);
    expect(outcome.status === 'ok' || outcome.status === 'parser_broken').toBe(true);
    expect((await readUser(store, 1, 'radar')).lastRun?.errors).toEqual({ parser_broken: 3 });
  });
});
