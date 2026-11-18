// Fetching attendance (M7.3). Only when the user opens the Presensi page,
// presses "Perbarui" there, or opens one course's details: never in a
// background sync. One GET for the recap, one GET per course detail
// opened, through the same client (allowlist, budget, queue, backoff).
// Answers are cached 24 hours; "Perbarui" waits 2 minutes between requests.
// Only monitored courses are kept.

import type { MoodleClient } from '../moodle/client';
import { readUser, writeUserIfCurrent } from '../storage';
import type { Clock, CourseId, CourseSnapshot, KeyValueStore, UnixSeconds, UserId } from '../types';
import { parseDetail, parseRecap } from './parse';
import { PRESENSI_CACHE_SEC, PRESENSI_COOLDOWN_SEC } from './rules';
import { EMPTY_PRESENSI, type PresensiData, type RecapRow } from './types';
import { detailPath, isReadOnlyAttendanceUrl, recapPath } from './urls';

export interface PresensiDeps {
  client: MoodleClient;
  store: KeyValueStore;
  clock: Clock;
  timeZone: string;
  userId: UserId;
  /** Courses Sulo follows (courses/active-score.ts). */
  monitored: ReadonlySet<CourseId>;
}

export type PresensiOutcome =
  | { status: 'ok' }
  | { status: 'fresh' }
  | { status: 'cooldown'; retryAt: UnixSeconds }
  | { status: 'no_attendance' }
  | { status: 'not_monitored' }
  | { status: 'unknown_shape' }
  | { status: 'failed'; reason: string };

export async function readPresensi(store: KeyValueStore, userId: UserId): Promise<PresensiData> {
  return { ...EMPTY_PRESENSI, ...((await readUser(store, userId, 'presensi')) ?? {}) };
}

/** The attendance activity of each course, from the stored course structures (no request). */
export function attendanceCmids(snapshots: Record<string, CourseSnapshot>): Map<CourseId, number> {
  const out = new Map<CourseId, number>();
  for (const snap of Object.values(snapshots)) {
    const cm = Object.values(snap.items).find((i) => i.module === 'attendance' && i.uservisible);
    if (cm) out.set(snap.courseId, cm.cmId);
  }
  return out;
}

export const onlyMonitored = (rows: readonly RecapRow[], monitored: ReadonlySet<CourseId>) => rows.filter((r) => monitored.has(r.courseId));

/** Points over all monitored courses with taken sessions; null without any. */
export function averagePercent(rows: readonly RecapRow[]): number | null {
  const got = rows.reduce((n, r) => n + (r.points && r.points.max > 0 ? r.points.got : 0), 0);
  const max = rows.reduce((n, r) => n + (r.points && r.points.max > 0 ? r.points.max : 0), 0);
  return max > 0 ? Math.round((got / max) * 1000) / 10 : null;
}

/**
 * Whether a request may go out now. force: "Perbarui" (only the cooldown
 * holds it back). Without force (the page or a detail was opened): only
 * when the cached copy is missing or older than 24 hours.
 */
export function mayRequest(cachedAt: UnixSeconds | null, lastRequestAt: UnixSeconds | null, now: UnixSeconds, force: boolean): PresensiOutcome | null {
  if (lastRequestAt !== null && now - lastRequestAt < PRESENSI_COOLDOWN_SEC) return { status: 'cooldown', retryAt: lastRequestAt + PRESENSI_COOLDOWN_SEC };
  if (!force && cachedAt !== null && now - cachedAt < PRESENSI_CACHE_SEC) return { status: 'fresh' };
  return null;
}

async function save(deps: PresensiDeps, next: PresensiData): Promise<boolean> {
  return writeUserIfCurrent(deps.store, deps.userId, 'presensi', next);
}

async function getPage(deps: PresensiDeps, path: string): Promise<{ html: string } | PresensiOutcome> {
  // Read-only by construction; checked again so no other URL can slip in.
  if (!isReadOnlyAttendanceUrl(path)) return { status: 'failed', reason: 'NOT_ALLOWLISTED' };
  const page = await deps.client.fetchPage(path, { source: 'attendance' });
  if (page.kind === 'ok') return { html: page.html };
  return { status: 'failed', reason: page.kind === 'refused' ? page.reason : page.kind };
}

/** The recap of every monitored course: one GET of "All courses". */
export async function refreshRecap(deps: PresensiDeps, options: { force: boolean }): Promise<PresensiOutcome> {
  const now = deps.clock.now();
  const data = await readPresensi(deps.store, deps.userId);
  const wait = mayRequest(data.recap?.fetchedAt ?? null, data.lastRequestAt, now, options.force);
  if (wait) return wait;
  // Any attendance activity opens the "All courses" tab; prefer a monitored course's.
  const cmids = attendanceCmids(await readUser(deps.store, deps.userId, 'snapshots'));
  const cmid = [...cmids].find(([course]) => deps.monitored.has(course))?.[1] ?? data.recap?.rows[0]?.cmid ?? [...cmids.values()][0];
  if (cmid === undefined) return { status: 'no_attendance' };
  await save(deps, { ...data, lastRequestAt: now });
  const page = await getPage(deps, recapPath(cmid));
  if (!('html' in page)) return page;
  const parsed = parseRecap(page.html);
  if (parsed.kind !== 'ok') {
    await save(deps, { ...data, lastRequestAt: now, unknownShapeAt: now });
    return { status: 'unknown_shape' };
  }
  await save(deps, { ...data, lastRequestAt: now, unknownShapeAt: null, recap: { fetchedAt: now, rows: onlyMonitored(parsed.value, deps.monitored) } });
  return { status: 'ok' };
}

/** One monitored course's sessions: one GET, only when its details are opened. */
export async function refreshDetail(deps: PresensiDeps, courseId: CourseId, options: { force: boolean }): Promise<PresensiOutcome> {
  if (!deps.monitored.has(courseId)) return { status: 'not_monitored' };
  const now = deps.clock.now();
  const data = await readPresensi(deps.store, deps.userId);
  const cmid = data.recap?.rows.find((r) => r.courseId === courseId)?.cmid ?? attendanceCmids(await readUser(deps.store, deps.userId, 'snapshots')).get(courseId);
  if (cmid === undefined) return { status: 'no_attendance' };
  const wait = mayRequest(data.details[String(cmid)]?.fetchedAt ?? null, data.lastRequestAt, now, options.force);
  if (wait) return wait;
  await save(deps, { ...data, lastRequestAt: now });
  const page = await getPage(deps, detailPath(cmid));
  if (!('html' in page)) return page;
  const parsed = parseDetail(page.html, deps.timeZone);
  if (parsed.kind !== 'ok') {
    await save(deps, { ...data, lastRequestAt: now, unknownShapeAt: now });
    return { status: 'unknown_shape' };
  }
  await save(deps, { ...data, lastRequestAt: now, unknownShapeAt: null, details: { ...data.details, [String(cmid)]: { fetchedAt: now, sessions: parsed.value } } });
  return { status: 'ok' };
}
