import { z } from 'zod';
import { isValidSesskey } from './sesskey';

// Messages between content script, popup and service worker.
// Every incoming message is validated before use.

export const messageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('sesskey/found'), sesskey: z.string().refine(isValidSesskey) }),
  z.object({ type: z.literal('status/get') }),
  z.object({ type: z.literal('connection/test') }),
]);

export type Message = z.infer<typeof messageSchema>;

export type ConnectionTestResult =
  | 'ok'
  | 'no_sesskey'
  | 'session_expired'
  | 'invalid_sesskey'
  | 'budget_exhausted'
  | 'offline'
  | 'server_error'
  | 'parser_broken';

export interface StatusResponse {
  hasSesskey: boolean;
  budgetUsed: number;
  budgetLimit: number;
}

export interface ConnectionTestResponse extends StatusResponse {
  result: ConnectionTestResult;
}
