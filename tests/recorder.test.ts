import { describe, expect, it } from 'vitest';
import type { MoodleCall } from '../lib/moodle/calls';
import type { BatchOutcome, MoodleClient } from '../lib/moodle/client';
import { recordFixtures } from '../lib/recorder';
import { fixedClock } from './helpers';

const ORIGIN = 'https://sikola-v2.unhas.ac.id';
const NIM = ['D', '12121', '1001'].join('');

const DATA: Record<string, unknown> = {
  core_session_time_remaining: { userid: 4242, timeremaining: 100 },
  core_course_get_enrolled_courses_by_timeline_classification: {
    courses: [{ id: 9876, fullname: 'Algoritma', shortname: 'ASD', startdate: 1_780_000_000, hidden: false }],
  },
  // Deliberately invalid for the schema: recording must still keep it.
  core_calendar_get_action_events_by_timesort: { events: [{ id: 1, name: 'Tugas Rahasia' }] },
  core_courseformat_get_state: JSON.stringify({ course: { id: 9876 }, section: [], cm: [] }),
  message_popup_get_popup_notifications: { notifications: [{ id: 3, subject: `Nilai untuk ${NIM}` }], unreadcount: 0 },
};

function fakeClient(): MoodleClient & { batches: MoodleCall[][] } {
  const batches: MoodleCall[][] = [];
  return {
    batches,
    async callBatch(callList): Promise<BatchOutcome> {
      batches.push([...callList]);
      return { kind: 'ok', results: callList.map((c) => ({ ok: true, data: DATA[c.methodname] })) };
    },
    async fetchPage() {
      return { kind: 'network_error' };
    },
  };
}

describe('recordFixtures', () => {
  it('records all five functions in two requests', async () => {
    const client = fakeClient();
    const outcome = await recordFixtures({ client, clock: fixedClock(), origin: ORIGIN, timeShiftSeconds: -86_400 });
    expect(client.batches).toHaveLength(2);
    expect(client.batches[1]?.map((c) => c.args)).toEqual([{ courseid: 9876 }, { useridto: 4242, limit: 20, offset: 0 }]);
    if (outcome.kind !== 'ok') throw new Error(`expected ok, got ${outcome.kind}`);
    expect(outcome.files.map((f) => f.filename).sort()).toEqual([
      'calendar-action-events.recorded.json',
      'courseformat-state.recorded.json',
      'enrolled-courses.recorded.json',
      'popup-notifications.recorded.json',
      'session-time-remaining.recorded.json',
    ]);
  });

  it('keeps responses that fail schema validation, with issue paths', async () => {
    const outcome = await recordFixtures({ client: fakeClient(), clock: fixedClock(), origin: ORIGIN, timeShiftSeconds: 0 });
    if (outcome.kind !== 'ok') throw new Error('expected ok');
    const calendar = JSON.parse(outcome.files.find((f) => f.filename.startsWith('calendar'))!.content);
    expect(calendar.schema.valid).toBe(false);
    expect(calendar.schema.issues.length).toBeGreaterThan(0);
    expect(calendar.data.events).toHaveLength(1);
  });

  it('sanitizes everything, including ids passed as arguments', async () => {
    const outcome = await recordFixtures({ client: fakeClient(), clock: fixedClock(), origin: ORIGIN, timeShiftSeconds: 0 });
    if (outcome.kind !== 'ok') throw new Error('expected ok');
    const all = outcome.files.map((f) => f.content).join('\n');
    for (const secret of ['Tugas Rahasia', 'Algoritma', NIM, '4242', '9876']) expect(all).not.toContain(secret);
  });

  it('reports a failed batch without saving anything', async () => {
    const client: MoodleClient = {
      callBatch: async () => ({ kind: 'refused', reason: 'BUDGET_EXHAUSTED' }),
      fetchPage: async () => ({ kind: 'network_error' }),
    };
    expect(await recordFixtures({ client, clock: fixedClock(), origin: ORIGIN, timeShiftSeconds: 0 })).toEqual({
      kind: 'failed',
      reason: 'refused: BUDGET_EXHAUSTED',
    });
  });
});
