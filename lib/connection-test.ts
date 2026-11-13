import type { ConnectionTestResult } from './messages';
import type { BatchOutcome, MoodleClient } from './moodle/client';
import { sessionTimeRemainingSchema } from './moodle/schemas';
import type { SessionState, UserId } from './types';

export interface ConnectionTestOutcome {
  result: ConnectionTestResult;
  /** null when the outcome says nothing about the session (e.g. refused). */
  sessionState: SessionState | null;
  userId: UserId | null;
  dropSesskey: boolean;
}

// M0: one call that proves the session cookie reaches SIKOLA from the
// service worker. Pure: the client is injected.
export async function runConnectionTest(client: MoodleClient): Promise<ConnectionTestOutcome> {
  const outcome = await client.callBatch([{ methodname: 'core_session_time_remaining', args: {} }]);
  return interpret(outcome);
}

function interpret(outcome: BatchOutcome): ConnectionTestOutcome {
  const base = { sessionState: null, userId: null, dropSesskey: false } as const;
  switch (outcome.kind) {
    case 'ok': {
      const first = outcome.results[0];
      if (!first?.ok) return { ...base, result: 'parser_broken' };
      const parsed = sessionTimeRemainingSchema.safeParse(first.data);
      if (!parsed.success) return { ...base, result: 'parser_broken' };
      return { result: 'ok', sessionState: 'OK', userId: parsed.data.userid, dropSesskey: false };
    }
    case 'refused':
      if (outcome.reason === 'NO_SESSKEY') return { ...base, result: 'no_sesskey' };
      if (outcome.reason === 'BUDGET_EXHAUSTED') return { ...base, result: 'budget_exhausted' };
      return { ...base, result: 'parser_broken' };
    case 'login_required':
      return { ...base, result: 'session_expired', sessionState: 'EXPIRED' };
    case 'invalid_sesskey':
      return { ...base, result: 'invalid_sesskey', dropSesskey: true };
    case 'network_error':
    case 'timeout':
      return { ...base, result: 'offline', sessionState: 'OFFLINE' };
    case 'http_error':
      return { ...base, result: 'server_error' };
    case 'bad_response':
      return { ...base, result: 'parser_broken' };
  }
}
