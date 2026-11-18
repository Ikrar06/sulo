// "Salin info untuk laporan bug": what Sulo copies, shown in full before it
// is copied. Pure. Version, browser, sync status, the NEOSIA module's state
// (on or off and when data last came, nothing else) and the last 20 lines
// of the technical log (time, Moodle function names, status). Never a name,
// student number, course, task, grade, sesskey or response content.

import type { TechLogEntry } from '../net/tech-log';
import type { SyncOutcome, UnixSeconds } from '../types';

export const REPORT_LOG_LINES = 20;

/** "Chrome 142", "Edge 142" from a user agent string; the rest of it is never copied. */
export function browserName(userAgent: string): string {
  const edge = /Edg\/(\d+)/.exec(userAgent);
  if (edge) return `Edge ${edge[1]}`;
  const chrome = /Chrome\/(\d+)/.exec(userAgent);
  return chrome ? `Chrome ${chrome[1]}` : 'unknown';
}

const iso = (at: UnixSeconds | null) => (at === null ? '-' : new Date(at * 1000).toISOString().replace('.000Z', 'Z'));

/** The outcome without its counts or ids: just what happened. */
const outcomeOf = (o: SyncOutcome | null) => (o === null ? '-' : o.status === 'skipped' ? `skipped:${o.reason}` : o.status);

export function buildBugReport(input: {
  version: string;
  userAgent: string;
  lastSyncAt: UnixSeconds | null;
  lastAttemptAt: UnixSeconds | null;
  lastOutcome: SyncOutcome | null;
  log: readonly TechLogEntry[];
  /** NEOSIA module: on or off, and the last time data came from NEOSIA. Never its data. */
  neosia?: { enabled: boolean; lastSeenAt: UnixSeconds | null };
}): string {
  const lines = [
    `Sulo ${input.version}`,
    `Browser: ${browserName(input.userAgent)}`,
    `Last good update: ${iso(input.lastSyncAt)}`,
    `Last attempt: ${iso(input.lastAttemptAt)} (${outcomeOf(input.lastOutcome)})`,
    `NEOSIA: ${input.neosia?.enabled ? `on, last data ${iso(input.neosia.lastSeenAt)}` : 'off'}`,
    '',
    `Last ${Math.min(REPORT_LOG_LINES, input.log.length)} requests:`,
    ...input.log.slice(0, REPORT_LOG_LINES).map((e) => `${iso(e.at)} ${e.status} ${e.fn}`),
  ];
  return lines.join('\n');
}
