import { describe, expect, it } from 'vitest';
import { calls } from '@sulo/core/moodle/calls';
import { callBatchOnceMore, createMoodleClient, interpretBatch, NOT_RUN_CODE } from '@sulo/core/moodle/client';
import { ACCESS_FLAG_AFTER, pickCoursesToCheck } from '@sulo/core/radar/schedule';
import { fakeFetch, fixedClock, jsonResponse, memoryStore } from './helpers';

const BASE = 'https://sikola-v2.unhas.ac.id';
const NOW = 1_794_000_000;
const ok = (data: unknown) => ({ error: false, data });
const err = (errorcode: string) => ({ error: true, exception: { errorcode, message: 'x' } });
const batch = [calls.sessionTimeRemaining(), calls.courseformatState(401), calls.courseformatState(402), calls.courseformatState(403)];

function client(answers: (() => Response)[]) {
  let i = 0;
  const fetch = fakeFetch(() => answers[Math.min(i++, answers.length - 1)]!());
  return { client: createMoodleClient({ fetch, store: memoryStore({}), clock: fixedClock('2026-11-20', 10, NOW), baseUrl: BASE, getSesskey: async () => 'SESSKEY001' }), fetch };
}

describe('a course that cannot be opened (owner-approved, 20 Nov 2026)', () => {
  it('Moodle stopping at a course is not a broken answer: the calls after it did not run', async () => {
    const outcome = await interpretBatch(jsonResponse([ok({ userid: 1, timeremaining: 7000 }), err('requireloginerror')]), batch);
    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') return;
    expect(outcome.results.slice(1)).toEqual([{ ok: false, errorcode: 'requireloginerror' }, { ok: false, errorcode: NOT_RUN_CODE }, { ok: false, errorcode: NOT_RUN_CODE }]);
  });

  it('the calls that did not run go once more, in ONE extra POST, merged back in place', async () => {
    const { client: c, fetch } = client([
      () => jsonResponse([ok({ userid: 1, timeremaining: 7000 }), err('requireloginerror')]),
      () => jsonResponse([ok({ userid: 1, timeremaining: 7000 }), ok({ s: 402 }), ok({ s: 403 })]),
    ]);
    const outcome = await callBatchOnceMore(c, batch, { source: 'manual' });
    expect(fetch.calls).toHaveLength(2);
    // The extra POST: the session call first, then only what did not run.
    expect(JSON.parse(String(fetch.calls[1]!.init?.body)).map((x: { methodname: string; args: { courseid?: number } }) => x.args.courseid ?? x.methodname)).toEqual(['core_session_time_remaining', 402, 403]);
    expect(outcome.kind === 'ok' && outcome.results).toEqual([{ ok: true, data: { userid: 1, timeremaining: 7000 } }, { ok: false, errorcode: 'requireloginerror' }, { ok: true, data: { s: 402 } }, { ok: true, data: { s: 403 } }]);
  });

  it('a second stop at another course: that one is marked too, the rest waits for the next sync', async () => {
    const { client: c, fetch } = client([
      () => jsonResponse([ok({ userid: 1, timeremaining: 7000 }), err('requireloginerror')]),
      () => jsonResponse([ok({ userid: 1, timeremaining: 7000 }), err('nopermissions')]),
      () => jsonResponse([ok({})]),
    ]);
    const outcome = await callBatchOnceMore(c, batch, { source: 'manual' });
    expect(fetch.calls).toHaveLength(2);
    expect(outcome.kind === 'ok' && outcome.results.slice(1)).toEqual([{ ok: false, errorcode: 'requireloginerror' }, { ok: false, errorcode: 'nopermissions' }, { ok: false, errorcode: NOT_RUN_CODE }]);
  });

  it('a whole batch that ran sends nothing more', async () => {
    const { client: c, fetch } = client([() => jsonResponse([ok({}), ok({}), ok({}), ok({})])]);
    await callBatchOnceMore(c, batch, { source: 'manual' });
    expect(fetch.calls).toHaveLength(1);
  });

  it('skipped 24 hours after a failure, a week after the third in a row', () => {
    const day = 86_400;
    const pick = (failures: number, ago: number) => pickCoursesToCheck([401], {}, NOW, { accessFailedAt: { '401': NOW - ago }, accessFailures: { '401': failures }, all: true });
    expect(pick(1, day - 60)).toEqual([]);
    expect(pick(1, day + 60)).toEqual([401]);
    expect(pick(ACCESS_FLAG_AFTER, 2 * day)).toEqual([]);
    expect(pick(ACCESS_FLAG_AFTER, 7 * day + 60)).toEqual([401]);
  });
});
