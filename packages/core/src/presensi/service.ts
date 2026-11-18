// Fetching attendance (M7.3). Only when the user opens the Presensi page,
// presses "Perbarui" there, or opens one course's details: never in a
// background sync. One GET for the recap, one GET per course detail
// opened, through the same client (allowlist, budget, queue, backoff).
// Answers are cached 24 hours; "Perbarui" waits 2 minutes between requests.
// Only monitored courses are kept.

import { calls } from '../moodle/calls';
import type { MoodleClient } from '../moodle/client';
import { parseCall } from '../moodle/schemas';
import { itemsFromState } from '../radar/snapshot';
import { storeCourseState } from '../radar/sync-step';
import { readUser, writeUserIfCurrent } from '../storage';
import type { Clock, CourseId, CourseSnapshot, KeyValueStore, UnixSeconds, UserId } from '../types';
import { parseDetail, parseRecap } from './parse';
import { PRESENSI_CACHE_SEC, PRESENSI_COOLDOWN_SEC } from './rules';
import { EMPTY_PRESENSI, type CmidSource, type PresensiData, type RecapRow } from './types';
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

/** At most this many course structures are fetched per click to find an attendance activity. */
export const MAX_CMID_PROBES = 3;

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

/**
 * The attendance activity of each course, from the stored course
 * structures of every course, followed or not (no request). An activity the
 * user can open comes first; a hidden one is kept as a last resort.
 */
export function attendanceCmids(snapshots: Record<string, CourseSnapshot>): Map<CourseId, number> {
  const out = new Map<CourseId, number>();
  for (const snap of Object.values(snapshots ?? {})) {
    const items = Object.values(snap?.items ?? {}).filter((i) => i.module === 'attendance');
    const cm = items.find((i) => i.uservisible) ?? items[0];
    if (cm) out.set(snap.courseId, cm.cmId);
  }
  return out;
}

/** Newest first, without repeats, at most 10. */
export const rememberCmids = (known: readonly number[] | undefined, ...cmids: number[]): number[] => [...new Set([...cmids, ...(known ?? [])])].slice(0, 10);

/** The attendance page the user opened on SIKOLA (content script, URL only): remember its cmid. */
export async function recordSeenCmid(store: KeyValueStore, userId: UserId, cmid: number): Promise<boolean> {
  if (!Number.isInteger(cmid) || cmid <= 0) return false;
  const data = await readPresensi(store, userId);
  if (data.knownCmids?.[0] === cmid) return true;
  return writeUserIfCurrent(store, userId, 'presensi', { ...data, knownCmids: rememberCmids(data.knownCmids, cmid) });
}

/**
 * An attendance activity for the "All courses" recap, in this order, stopping
 * at the first that works:
 * a. the stored structures of every course (a followed course's first);
 * b. a cmid seen before (recap, course structure, a page the user opened);
 * c. only when allowed (the user opened the page or pressed Perbarui): one
 *    core_courseformat_get_state at a time for followed courses, never
 *    checked or checked longest ago first, at most MAX_CMID_PROBES, through
 *    the client (budget, queue, backoff);
 * d. none: null.
 */
export async function findRecapCmid(deps: PresensiDeps, data: PresensiData, allowProbe: boolean): Promise<{ cmid: number | null; via: CmidSource | null; probes: number }> {
  const snapshots = await readUser(deps.store, deps.userId, 'snapshots');
  const fromSnapshots = attendanceCmids(snapshots);
  const followed = [...fromSnapshots].find(([course]) => deps.monitored.has(course))?.[1] ?? [...fromSnapshots.values()][0];
  if (followed !== undefined) return { cmid: followed, via: 'snapshot', probes: 0 };
  if (data.knownCmids && data.knownCmids.length > 0) return { cmid: data.knownCmids[0]!, via: 'known', probes: 0 };
  if (!allowProbe) return { cmid: null, via: null, probes: 0 };
  const checked = (await readUser(deps.store, deps.userId, 'radar')).stateCheckedAt;
  const candidates = [...deps.monitored]
    // A course whose stored structure has no attendance is not asked again.
    .filter((id) => !snapshots[String(id)])
    .sort((a, b) => (checked[String(a)] ?? 0) - (checked[String(b)] ?? 0) || a - b)
    .slice(0, MAX_CMID_PROBES);
  let probes = 0;
  for (const courseId of candidates) {
    probes += 1;
    const outcome = await deps.client.callBatch([calls.courseformatState(courseId)], { source: 'attendance' });
    if (outcome.kind !== 'ok') break;
    const parsed = parseCall('core_courseformat_get_state', outcome.results[0]!);
    if (!parsed.ok) continue;
    const all = itemsFromState(parsed.data);
    // The structure is kept like the radar's (a first one is a baseline).
    await storeCourseState(deps.store, deps.userId, courseId, all, deps.clock.now());
    const items = all.filter((i) => i.module === 'attendance');
    const cm = items.find((i) => i.uservisible) ?? items[0];
    if (cm) return { cmid: cm.cmId, via: 'probe', probes };
  }
  return { cmid: null, via: null, probes };
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
  // Opening a view with a fresh copy: nothing to fetch.
  if (!force && cachedAt !== null && now - cachedAt < PRESENSI_CACHE_SEC) return { status: 'fresh' };
  // The same target asked again within 2 minutes (each target has its own cooldown).
  if (lastRequestAt !== null && now - lastRequestAt < PRESENSI_COOLDOWN_SEC) return { status: 'cooldown', retryAt: lastRequestAt + PRESENSI_COOLDOWN_SEC };
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
  // Any attendance activity opens the global "All courses" tab.
  const found = await findRecapCmid(deps, data, true);
  const note = (status: string, reason?: string) => ({ at: now, status, ...(reason ? { reason } : {}), ...(found.via ? { via: found.via } : {}), probes: found.probes });
  if (found.cmid === null) {
    // Probes count against the cooldown too.
    await save(deps, { ...data, ...(found.probes > 0 ? { lastRequestAt: now } : {}), lastOutcome: note('no_attendance') });
    return { status: 'no_attendance' };
  }
  const known = rememberCmids(data.knownCmids, found.cmid);
  await save(deps, { ...data, knownCmids: known, lastRequestAt: now });
  const page = await getPage(deps, recapPath(found.cmid));
  if (!('html' in page)) {
    await save(deps, { ...data, knownCmids: known, lastRequestAt: now, lastOutcome: note(page.status, 'reason' in page ? page.reason : undefined) });
    return page;
  }
  const parsed = parseRecap(page.html);
  if (parsed.kind !== 'ok') {
    await save(deps, { ...data, knownCmids: known, lastRequestAt: now, unknownShapeAt: now, lastOutcome: note('unknown_shape') });
    return { status: 'unknown_shape' };
  }
  const rows = onlyMonitored(parsed.value, deps.monitored);
  await save(deps, {
    ...data,
    knownCmids: rememberCmids(known, ...rows.map((r) => r.cmid)).slice(0, 10),
    lastRequestAt: now,
    unknownShapeAt: null,
    recap: { fetchedAt: now, rows },
    lastOutcome: { ...note('ok'), reason: `${parsed.value.length} rows, ${rows.length} followed` },
  });
  return { status: 'ok' };
}

/** One monitored course's sessions: one GET, only when its details are opened. */
export async function refreshDetail(deps: PresensiDeps, courseId: CourseId, options: { force: boolean }): Promise<PresensiOutcome> {
  if (!deps.monitored.has(courseId)) return { status: 'not_monitored' };
  const now = deps.clock.now();
  const data = await readPresensi(deps.store, deps.userId);
  const cmid = data.recap?.rows.find((r) => r.courseId === courseId)?.cmid ?? attendanceCmids(await readUser(deps.store, deps.userId, 'snapshots')).get(courseId);
  if (cmid === undefined) return { status: 'no_attendance' };
  const key = String(cmid);
  const wait = mayRequest(data.details[key]?.fetchedAt ?? null, data.detailRequestAt?.[key] ?? null, now, options.force);
  if (wait) return wait;
  const detailRequestAt = { ...(data.detailRequestAt ?? {}), [key]: now };
  await save(deps, { ...data, detailRequestAt });
  const page = await getPage(deps, detailPath(cmid));
  if (!('html' in page)) return page;
  const parsed = parseDetail(page.html, deps.timeZone);
  if (parsed.kind !== 'ok') {
    await save(deps, { ...data, detailRequestAt, unknownShapeAt: now });
    return { status: 'unknown_shape' };
  }
  await save(deps, { ...data, detailRequestAt, unknownShapeAt: null, details: { ...data.details, [key]: { fetchedAt: now, sessions: parsed.value } } });
  return { status: 'ok' };
}

/** Development builds: how attendance looks in storage (counts and ids, no names). */
export interface PresensiDiagnosis {
  coursesWithSnapshot: number;
  followedWithSnapshot: number;
  modulesByName: Record<string, number>;
  attendanceModules: number;
  attendanceVisible: number;
  knownCmids: number[];
  recapFetched: boolean;
  recapRows: number;
  followed: number;
  followedWithNumbers: number;
  followedNotInRecap: CourseId[];
  lastOutcome: PresensiData['lastOutcome'] | null;
}

export function diagnose(snapshots: Record<string, CourseSnapshot>, data: PresensiData, monitored: ReadonlySet<CourseId>): PresensiDiagnosis {
  const modulesByName: Record<string, number> = {};
  let attendanceModules = 0;
  let attendanceVisible = 0;
  const snaps = Object.values(snapshots ?? {});
  for (const snap of snaps) {
    for (const item of Object.values(snap?.items ?? {})) {
      modulesByName[item.module] = (modulesByName[item.module] ?? 0) + 1;
      if (item.module === 'attendance') {
        attendanceModules += 1;
        if (item.uservisible) attendanceVisible += 1;
      }
    }
  }
  const rows = data.recap?.rows ?? [];
  const inRecap = new Set(rows.map((r) => r.courseId));
  return {
    coursesWithSnapshot: snaps.length,
    followedWithSnapshot: snaps.filter((s) => monitored.has(s.courseId)).length,
    modulesByName: Object.fromEntries(Object.entries(modulesByName).sort((a, b) => b[1] - a[1])),
    attendanceModules,
    attendanceVisible,
    knownCmids: data.knownCmids ?? [],
    recapFetched: data.recap !== null,
    recapRows: rows.length,
    followed: monitored.size,
    followedWithNumbers: rows.filter((r) => r.taken > 0).length,
    followedNotInRecap: [...monitored].filter((id) => data.recap !== null && !inRecap.has(id)),
    lastOutcome: data.lastOutcome ?? null,
  };
}

/**
 * One followed course on the Presensi page. Before the recap was ever
 * fetched: "not_fetched" (never "no attendance"). After: in the recap it has
 * numbers (or no sessions yet); missing from it, it has no attendance.
 */
export function courseStatus(row: RecapRow | undefined, recapFetched: boolean): 'not_fetched' | 'no_module' | 'no_sessions' | 'numbers' {
  if (!recapFetched) return 'not_fetched';
  if (!row) return 'no_module';
  return row.taken === 0 ? 'no_sessions' : 'numbers';
}
