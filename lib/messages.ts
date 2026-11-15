import { z } from 'zod';
import type { RecordedFile } from './recorder';
import { isValidSesskey } from './sesskey';

// Messages between content script, popup, recorder page and service worker.
// Every incoming message is validated before use.

export const messageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('sesskey/found'), sesskey: z.string().refine(isValidSesskey) }),
  z.object({ type: z.literal('status/get') }),
  z.object({ type: z.literal('popup/opened') }),
  z.object({ type: z.literal('sync/request'), trigger: z.enum(['popup', 'manual', 'onboarding']) }),
  /** "Kirim notifikasi uji" in the reminder settings. */
  z.object({ type: z.literal('notify/test') }),
]);
// Dev-only messages live in lib/dev/messages.ts and are handled by a module
// that only development builds contain (scripts/check-no-dev-code.mjs).

export type Message = z.infer<typeof messageSchema>;

export type ConnectionTestResult =
  | 'ok'
  | 'no_sesskey'
  | 'session_expired'
  | 'invalid_sesskey'
  | 'budget_exhausted'
  | 'backing_off'
  | 'disabled_remotely'
  | 'offline'
  | 'server_error'
  | 'parser_broken';

export interface StatusResponse {
  hasSesskey: boolean;
  budgetUsed: number;
  budgetLimit: number;
  /** Message from the remote config when the extension is disabled remotely. */
  disabledMessage: string | null;
}

export type RecordResponse =
  | { kind: 'ok'; files: RecordedFile[] }
  | { kind: 'failed'; reason: string }
  | { kind: 'leak_detected'; rules: string[] };
