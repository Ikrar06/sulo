import { describe, expect, it } from 'vitest';
import { runConnectionTest } from '../lib/connection-test';
import type { BatchOutcome, MoodleClient } from '../lib/moodle/client';

const clientReturning = (outcome: BatchOutcome): MoodleClient => ({
  callBatch: async () => outcome,
  fetchPage: async () => ({ kind: 'network_error' }),
});

describe('runConnectionTest', () => {
  it('reports ok with the userid when the session is alive', async () => {
    const outcome = await runConnectionTest(
      clientReturning({ kind: 'ok', results: [{ ok: true, data: { userid: 7, timeremaining: 600 } }] }),
    );
    expect(outcome).toEqual({ result: 'ok', sessionState: 'OK', userId: 7, dropSesskey: false });
  });

  it('flags a response without userid as parser broken', async () => {
    const outcome = await runConnectionTest(clientReturning({ kind: 'ok', results: [{ ok: true, data: { timeremaining: 1 } }] }));
    expect(outcome.result).toBe('parser_broken');
    expect(outcome.sessionState).toBeNull();
  });

  it.each<[BatchOutcome, string, string | null]>([
    [{ kind: 'login_required' }, 'session_expired', 'EXPIRED'],
    [{ kind: 'network_error' }, 'offline', 'OFFLINE'],
    // A timeout means SIKOLA is slow, not that the user is offline.
    [{ kind: 'timeout' }, 'server_error', null],
    [{ kind: 'http_error', status: 500 }, 'server_error', null],
    [{ kind: 'refused', reason: 'NO_SESSKEY' }, 'no_sesskey', null],
    [{ kind: 'refused', reason: 'BUDGET_EXHAUSTED' }, 'budget_exhausted', null],
    [{ kind: 'bad_response', detail: 'x' }, 'parser_broken', null],
  ])('%o -> %s', async (batch, result, state) => {
    const outcome = await runConnectionTest(clientReturning(batch));
    expect(outcome.result).toBe(result);
    expect(outcome.sessionState).toBe(state);
  });

  it('drops the sesskey when Moodle rejects it', async () => {
    const outcome = await runConnectionTest(clientReturning({ kind: 'invalid_sesskey' }));
    expect(outcome).toMatchObject({ result: 'invalid_sesskey', dropSesskey: true });
  });
});
