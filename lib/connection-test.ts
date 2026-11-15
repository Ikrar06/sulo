import type { ConnectionTestResult } from './messages';
import { calls } from './moodle/calls';
import type { BatchOutcome, MoodleClient } from './moodle/client';
import { parseCall } from './moodle/schemas';
import type { ClientRefusal, SessionState, UserId } from './types';

export interface ConnectionTestOutcome {
  result: ConnectionTestResult;
  /** null when the outcome says nothing new about the session. */
  sessionState: SessionState | null;
  userId: UserId | null;
  dropSesskey: boolean;
}

const REFUSAL_RESULT: Record<ClientRefusal, ConnectionTestResult> = {
  NO_SESSKEY: 'no_sesskey',
  BUDGET_EXHAUSTED: 'budget_exhausted',
  BACKING_OFF: 'backing_off',
  SESSION_EXPIRED: 'session_expired',
  DISABLED_REMOTELY: 'disabled_remotely',
  NOT_ALLOWLISTED: 'parser_broken',
};

// One call that proves the session cookie reaches SIKOLA from the service
// worker. Pure: the client is injected.
export async function runConnectionTest(client: MoodleClient): Promise<ConnectionTestOutcome> {
  return interpret(await client.callBatch([calls.sessionTimeRemaining()], { source: 'connection-test' }));
}

function interpret(outcome: BatchOutcome): ConnectionTestOutcome {
  const base = { sessionState: null, userId: null, dropSesskey: false } as const;
  switch (outcome.kind) {
    case 'ok': {
      const first = outcome.results[0];
      if (!first) return { ...base, result: 'parser_broken' };
      const parsed = parseCall('core_session_time_remaining', first);
      if (!parsed.ok) return { ...base, result: 'parser_broken' };
      return { result: 'ok', sessionState: 'OK', userId: parsed.data.userid, dropSesskey: false };
    }
    case 'refused':
      return { ...base, result: REFUSAL_RESULT[outcome.reason] };
    case 'login_required':
      return { ...base, result: 'session_expired', sessionState: 'EXPIRED' };
    case 'invalid_sesskey':
      return { ...base, result: 'invalid_sesskey', dropSesskey: true };
    case 'network_error':
      return { ...base, result: 'offline', sessionState: 'OFFLINE' };
    // A timeout means SIKOLA is slow, not that the user is offline.
    case 'timeout':
    case 'http_error':
      return { ...base, result: 'server_error' };
    case 'bad_response':
      return { ...base, result: 'parser_broken' };
  }
}
