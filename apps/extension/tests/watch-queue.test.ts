import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MoodleCall } from '@sulo/core/moodle/calls';
import type { MoodleClient } from '@sulo/core/moodle/client';
import { ACCOUNT_PENDING_KEY } from '@sulo/core/account/pending';
import { readUser } from '@sulo/core/storage';
import { runSync } from '@sulo/core/sync/run-sync';
import { applyWatchAnswers, markChangesHandled } from '@sulo/core/watch/queue';
import { fixedClock, memoryStore } from './helpers';

const fx = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/synthetic/${name}.json`, import.meta.url), 'utf8'));
const NOW = 1_790_000_000;
const DAY = 86_400;

function client(): MoodleClient {
  const all = fx('enrolled-courses.normal');
  const data = (c: MoodleCall): unknown => {
    switch (c.methodname) {
      case 'core_session_time_remaining':
        return { userid: 1, timeremaining: 7200 };
      case 'core_calendar_get_action_events_by_timesort':
        return fx('calendar-action-events.normal');
      case 'message_popup_get_popup_notifications':
        return fx('popup-notifications.normal');
      case 'core_courseformat_get_state':
        return fx('courseformat-state.normal');
      default:
        return c.args.classification === 'inprogress' ? { courses: all.courses.filter((x: { id: number }) => [401, 402, 403].includes(x.id)), nextoffset: 3 } : all;
    }
  };
  return { callBatch: async (list) => ({ kind: 'ok', results: list.map((c) => ({ ok: true, data: data(c) })) }), fetchPage: async () => ({ kind: 'network_error' }) };
}

/** A background answer as the worker stores it: Moodle's array in batch order (session, calendar, notifications). */
const answer = (ranAt: number, events: unknown[]) => ({
  ranAt,
  plannedAt: ranAt,
  radarIds: [],
  body: JSON.stringify([
    { error: false, data: { userid: 1, timeremaining: 7000 } },
    { error: false, data: { events } },
    { error: false, data: fx('popup-notifications.normal') },
  ]),
});

async function signedIn() {
  const store = memoryStore();
  await runSync({ client: client(), store, clock: fixedClock('2026-09-22', 10, NOW), trigger: 'onboarding', idleState: 'active' });
  return store;
}

describe('background answers read by core', () => {
  it('a new task in an answer becomes a task and one unseen entry, handled without a notification', async () => {
    const store = await signedIn();
    const base = fx('calendar-action-events.normal').events;
    const extra = { ...base[0], id: 104, name: 'Kuis 4 is due', activityname: 'Kuis 4', timesort: NOW + 3 * DAY, url: 'https://sikola-v2.unhas.ac.id/mod/assign/view.php?id=9104' };
    const clock = fixedClock('2026-09-22', 11, NOW + 3600);
    // The calendar's first pass is a silent baseline, then the new task is news.
    await applyWatchAnswers({ store, clock }, [answer(NOW + 1800, base)]);
    const applied = await applyWatchAnswers({ store, clock }, [answer(NOW + 3600, [...base, extra])]);
    expect(applied[0]?.outcome.status).toBe('ok');
    const tasks = await readUser(store, 1, 'tasks');
    expect(tasks.some((t) => t.eventId === 104)).toBe(true);
    const log = await readUser(store, 1, 'changes');
    expect(log.filter((e) => e.id === 'task:104:added')).toHaveLength(1);
    expect(await markChangesHandled(store, NOW + 3600)).toBeGreaterThan(0);
    expect((await readUser(store, 1, 'notified'))['c:task:104:added']).toBe(NOW + 3600);
    expect(await markChangesHandled(store, NOW + 3700)).toBe(0);
    // The same answer again adds nothing twice.
    await applyWatchAnswers({ store, clock }, [answer(NOW + 3600, [...base, extra])]);
    expect((await readUser(store, 1, 'changes')).filter((e) => e.id === 'task:104:added')).toHaveLength(1);
  });

  it('an unreadable answer is reported and changes nothing', async () => {
    const store = await signedIn();
    const before = await readUser(store, 1, 'tasks');
    const out = await applyWatchAnswers({ store, clock: fixedClock('2026-09-22', 11, NOW + 60) }, [{ ranAt: NOW + 60, plannedAt: NOW + 60, radarIds: [], body: '<html>' }]);
    expect(out[0]?.outcome.status).toBe('unreadable');
    expect(await readUser(store, 1, 'tasks')).toEqual(before);
  });

  it('a pending account switch reads nothing (hard rule 10)', async () => {
    const store = await signedIn();
    await store.set(ACCOUNT_PENDING_KEY, { userId: 2, detectedAt: NOW, lastCheckAt: NOW });
    expect(await applyWatchAnswers({ store, clock: fixedClock('2026-09-22', 11, NOW + 60) }, [answer(NOW + 60, [])])).toEqual([]);
  });

  it('another account in an answer is not written', async () => {
    const store = await signedIn();
    const body = JSON.stringify([{ error: false, data: { userid: 2, timeremaining: 7000 } }, { error: false, data: { events: [] } }, { error: false, data: fx('popup-notifications.normal') }]);
    const out = await applyWatchAnswers({ store, clock: fixedClock('2026-09-22', 11, NOW + 60) }, [{ ranAt: NOW + 60, plannedAt: NOW + 60, radarIds: [], body }]);
    expect(out[0]?.outcome.status).toBe('account_mismatch');
    expect((await readUser(store, 1, 'tasks')).length).toBeGreaterThan(0);
  });
});
