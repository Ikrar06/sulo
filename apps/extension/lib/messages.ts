import { z } from 'zod';
import type { RecordedFile } from './recorder';
import { isValidSesskey } from '@sulo/core/sesskey';

// Messages between content script, popup, recorder page and service worker.
// Every incoming message is validated before use.

export const messageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('sesskey/found'), sesskey: z.string().refine(isValidSesskey) }),
  /** Content script: the user opened a SIKOLA page that is logged out. */
  z.object({ type: z.literal('session/loggedOut') }),
  z.object({ type: z.literal('status/get') }),
  z.object({ type: z.literal('popup/opened') }),
  /** The popup never syncs on open; only "Perbarui" (manual) and setup ask. */
  /** forceCourseList: "Segarkan daftar" in "Mata kuliahmu" (the 24-hour TTL is skipped once). */
  z.object({ type: z.literal('sync/request'), trigger: z.enum(['manual', 'onboarding']), forceCourseList: z.boolean().optional() }),
  /** "Pakai akun ini": delete the previous account's data and set up the new one. */
  z.object({ type: z.literal('account/useNew') }),
  /** "Nanti, aku akan masuk dengan akun sebelumnya": keep everything hidden. */
  z.object({ type: z.literal('account/defer') }),
  /** "Hapus semua data" after its confirmation dialog. */
  z.object({ type: z.literal('data/wipeAll') }),
  /** "Kirim notifikasi uji" in the reminder settings. */
  z.object({ type: z.literal('notify/test') }),
  /**
   * Presensi page (M7.3), only from the user: opening the page or a course's
   * details (force=false: only when the copy is older than 24 hours), or
   * "Perbarui" there (force=true, 2-minute cooldown).
   */
  z.object({ type: z.literal('presensi/refresh'), target: z.enum(['recap', 'detail']), courseId: z.number().int().positive().optional(), force: z.boolean() }),
  /** The dashboard got the NEOSIA permissions in the consent dialog: register the scripts. */
  z.object({ type: z.literal('neosia/enable') }),
  /** "Putuskan dan hapus data": scripts off, permissions removed, NEOSIA data deleted. */
  z.object({ type: z.literal('neosia/disable') }),
  /**
   * Bridge on a NEOSIA page: one projected response. Checked loosely here;
   * the service worker validates `capture` with the allowlist schema
   * (lib/neosia/schema.ts) before anything is stored.
   */
  z.object({ type: z.literal('neosia/capture'), capture: z.unknown() }),
]);
// Dev-only messages live in lib/dev/messages.ts and are handled by a module
// that only development builds contain (scripts/check-no-dev-code.mjs).

export type Message = z.infer<typeof messageSchema>;

// Lives with the shared types (packages/core); re-exported for existing imports.
export type { ConnectionTestResult } from '@sulo/core/types';

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
