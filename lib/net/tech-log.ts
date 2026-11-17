// Technical log, every build: the last 300 requests to SIKOLA with their
// time, the Moodle function names and the outcome. Nothing else: no query
// string, sesskey, parameters or response content. Stored locally only,
// never sent; "Hapus semua data" clears it with everything else; the bug
// report copy (Pengaturan) shows the last 20 before anything is copied.

import type { KeyValueStore, UnixSeconds } from '../types';

export const TECH_LOG_KEY = 'global:techLog';
export const TECH_LOG_MAX = 300;

export interface TechLogEntry {
  at: UnixSeconds;
  /** Moodle function names of a batch ("core_session_time_remaining+core_calendar_…"), or "page" for an HTML page. */
  fn: string;
  /** Outcome kind, plus the refusal reason when refused ("refused:BACKING_OFF"). */
  status: string;
}

/** Newest first, at most TECH_LOG_MAX (a ring buffer). */
export function appendTechLog(log: readonly TechLogEntry[], entry: TechLogEntry): TechLogEntry[] {
  return [entry, ...log].slice(0, TECH_LOG_MAX);
}

export async function readTechLog(store: KeyValueStore): Promise<TechLogEntry[]> {
  return (await store.get<TechLogEntry[]>(TECH_LOG_KEY)) ?? [];
}

export async function recordTech(store: KeyValueStore, entry: TechLogEntry): Promise<void> {
  await store.set(TECH_LOG_KEY, appendTechLog(await readTechLog(store), entry));
}

/** "ok", "login_required", "refused:BACKING_OFF"…: the outcome without any data. */
export const statusOf = (outcome: { kind: string; reason?: string }): string => (outcome.kind === 'refused' && outcome.reason ? `refused:${outcome.reason}` : outcome.kind);
