import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MoodleCall } from '@sulo/core/moodle/calls';
import { createMoodleClient, type MoodleClient, type PageOutcome } from '@sulo/core/moodle/client';
import { parseDetail, parseRecap, statusOf } from '@sulo/core/presensi/parse';
import { MIN_ATTENDANCE_PERCENT, PRESENSI_CACHE_SEC, PRESENSI_COOLDOWN_SEC } from '@sulo/core/presensi/rules';
import { attendanceCmids, averagePercent, mayRequest, onlyMonitored, readPresensi, refreshDetail, refreshRecap, type PresensiDeps } from '@sulo/core/presensi/service';
import { detailPath, isReadOnlyAttendanceUrl, recapPath } from '@sulo/core/presensi/urls';
import { switchUser, writeUser } from '@sulo/core/storage';
import { runSync } from '@sulo/core/sync/run-sync';
import type { SyncTrigger } from '@sulo/core/types';
import { fixedClock, memoryStore } from './helpers';

const page = (name: string) => readFileSync(new URL(`../fixtures/synthetic/pages/${name}.html`, import.meta.url), 'utf8');
const fx = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/synthetic/${name}.json`, import.meta.url), 'utf8'));
const TZ = 'Asia/Makassar';
const NOW = 1_794_000_000;

describe('recap ("All courses", mode=1)', () => {
  const parsed = parseRecap(page('attendance-all-courses'));
  it('golden', async () => {
    expect(parsed.kind).toBe('ok');
    await expect(`${JSON.stringify(parsed, null, 2)}\n`).toMatchFileSnapshot('../fixtures/presensi/golden/recap.json');
  });
  it('reads course id, attendance cmid, taken sessions, points and percentage; "-" is null; the average row is skipped', () => {
    if (parsed.kind !== 'ok') throw new Error('shape');
    expect(parsed.value).toHaveLength(44);
    expect(parsed.value[0]).toEqual({ courseId: 36673, cmid: 197570, taken: 16, points: { got: 31, max: 32 }, percent: 96.9 });
    expect(parsed.value.find((r) => r.courseId === 27353)).toEqual({ courseId: 27353, cmid: 161378, taken: 0, points: { got: 0, max: 0 }, percent: null });
  });
  it('another page is "unknown_shape", never an error', () => {
    expect(parseRecap('<html><body><table><tr><td>x</td></tr></table></body></html>')).toEqual({ kind: 'unknown_shape' });
    expect(parseRecap(page('attendance-course'))).toEqual({ kind: 'unknown_shape' });
  });
});

describe('details (one course, view=5 "All")', () => {
  it('an empty month: no sessions', () => {
    expect(parseDetail(page('attendance-course'), TZ)).toEqual({ kind: 'ok', value: [] });
  });
  it('golden (synthetic sessions in the real markup)', async () => {
    const parsed = parseDetail(page('attendance-course-sessions.synthetic'), TZ);
    expect(parsed.kind).toBe('ok');
    await expect(`${JSON.stringify(parsed, null, 2)}\n`).toMatchFileSnapshot('../fixtures/presensi/golden/detail.json');
    if (parsed.kind !== 'ok') return;
    expect(parsed.value.map((s) => s.status)).toEqual(['present', 'late', 'excused', 'absent', 'present', 'excused', 'unknown']);
    expect(parsed.value[0]).toMatchObject({ dateText: 'Wed 3.09.25', timeText: '7:30AM - 10AM', description: 'Regular class session', points: { got: 2, max: 2 }, remarks: '' });
    // 3 September 2025, 07.30 WITA.
    expect(parsed.value[0]!.at).toBe(Date.UTC(2025, 8, 2, 23, 30) / 1000);
    expect(parsed.value[6]).toMatchObject({ statusText: '?', points: null, at: Date.UTC(2025, 9, 15, 5, 0) / 1000 });
  });
  it('status words in English and Indonesian; others stay "unknown"', () => {
    expect(['Present', 'Hadir', 'Late', 'Terlambat', 'Excused', 'Izin', 'Absent', 'Tidak hadir', 'Alpa', 'Anwesend'].map(statusOf)).toEqual([
      'present', 'present', 'late', 'late', 'excused', 'excused', 'absent', 'absent', 'absent', 'unknown',
    ]);
  });
  it('another page is "unknown_shape"', () => {
    expect(parseDetail(page('attendance-all-courses'), TZ)).toEqual({ kind: 'unknown_shape' });
  });
});

describe('read-only URLs', () => {
  it('builds the recap and detail URLs with id, mode and view only', () => {
    expect(recapPath(197570)).toBe('/mod/attendance/view.php?id=197570&mode=1');
    expect(detailPath(197570)).toBe('/mod/attendance/view.php?id=197570&view=5');
    expect(isReadOnlyAttendanceUrl(recapPath(1)) && isReadOnlyAttendanceUrl(detailPath(1))).toBe(true);
  });
  it('refuses anything that could mark attendance or change data', () => {
    for (const url of [
      '/mod/attendance/take.php?id=1',
      '/mod/attendance/sessions.php?id=1',
      '/mod/attendance/attendance.php?sessid=1&sesskey=x',
      '/mod/attendance/view.php?id=1&submit=1',
      '/mod/attendance/view.php?id=1&sesskey=abc',
      '/mod/attendance/view.php?id=1&studentid=2',
      '/mod/attendance/view.php?id=1&status=3',
      '/mod/attendance/view.php?id=abc',
      '/mod/attendance/view.php',
    ]) {
      expect(isReadOnlyAttendanceUrl(url), url).toBe(false);
    }
  });
  it('the SIKOLA client itself refuses those URLs before any request', async () => {
    const fetched: string[] = [];
    const store = memoryStore();
    const client = createMoodleClient({ fetch: async (url) => (fetched.push(url), new Response('')), store, clock: fixedClock(), baseUrl: 'https://sikola-v2.unhas.ac.id', getSesskey: async () => 'abcdef1234' });
    for (const url of ['/mod/attendance/view.php?id=1&take=1', '/mod/attendance/view.php?id=1&submit=1', '/mod/attendance/sessions.php?id=1']) {
      expect(await client.fetchPage(url)).toEqual({ kind: 'refused', reason: 'NOT_ALLOWLISTED' });
    }
    expect(fetched).toEqual([]);
  });
});

/** A client that records page requests and answers attendance pages from fixtures. */
function pageClient(answer: (path: string) => PageOutcome = (p) => ({ kind: 'ok', html: p.includes('mode=1') ? page('attendance-all-courses') : page('attendance-course-sessions.synthetic') })): MoodleClient & { pages: string[] } {
  const pages: string[] = [];
  return {
    pages,
    async callBatch() {
      throw new Error('no batch expected');
    },
    async fetchPage(path) {
      pages.push(path);
      return answer(path);
    },
  };
}

async function setup(monitored = new Set([36673, 48298])) {
  const store = memoryStore();
  await switchUser(store, 1);
  const snapshot = (courseId: number, cmId: number, module: string) => ({
    userId: 1, courseId, fetchedAt: NOW, parserVersion: 1,
    items: { [cmId]: { cmId, module, name: 'Presensi', sectionId: 1, visible: true, uservisible: true, url: null, firstSeenAt: NOW, missCount: 0 } },
  });
  await writeUser(store, 1, 'snapshots', { '36673': snapshot(36673, 197570, 'attendance'), '99999': snapshot(99999, 5, 'assign') } as never);
  let now = NOW;
  const clock = { ...fixedClock(), now: () => now };
  const client = pageClient();
  const deps: PresensiDeps = { client, store, clock, timeZone: TZ, userId: 1, monitored };
  return { store, client, deps, advance: (s: number) => void (now += s) };
}

describe('fetching: monitored courses only, 24-hour cache, 2-minute cooldown', () => {
  it('finds the attendance activity in the stored course structures, without a request', async () => {
    const { store } = await setup();
    const { readUser } = await import('@sulo/core/storage');
    expect([...attendanceCmids(await readUser(store, 1, 'snapshots'))]).toEqual([[36673, 197570]]);
  });

  it('opening the page: one GET of the recap, kept for monitored courses only', async () => {
    const { client, deps, store } = await setup();
    expect(await refreshRecap(deps, { force: false })).toEqual({ status: 'ok' });
    expect(client.pages).toEqual(['/mod/attendance/view.php?id=197570&mode=1']);
    const data = await readPresensi(store, 1);
    expect(data.recap?.rows.map((r) => r.courseId)).toEqual([36673, 48298]);
    expect(averagePercent(data.recap!.rows)).toBe(98.4);
  });

  it('opening the page again within 24 hours sends nothing; after that, once', async () => {
    const { client, deps, advance } = await setup();
    await refreshRecap(deps, { force: false });
    advance(PRESENSI_CACHE_SEC - 1);
    expect(await refreshRecap(deps, { force: false })).toEqual({ status: 'fresh' });
    advance(1);
    expect(await refreshRecap(deps, { force: false })).toEqual({ status: 'ok' });
    expect(client.pages).toHaveLength(2);
  });

  it('"Perbarui" waits 2 minutes between requests', async () => {
    const { client, deps, advance } = await setup();
    await refreshRecap(deps, { force: true });
    advance(PRESENSI_COOLDOWN_SEC - 1);
    expect((await refreshRecap(deps, { force: true })).status).toBe('cooldown');
    advance(1);
    expect(await refreshRecap(deps, { force: true })).toEqual({ status: 'ok' });
    expect(client.pages).toHaveLength(2);
  });

  it('details: one GET per monitored course opened; never for a course Sulo does not follow', async () => {
    const { client, deps, store } = await setup();
    await refreshRecap(deps, { force: false });
    expect(await refreshDetail(deps, 99999, { force: false })).toEqual({ status: 'not_monitored' });
    deps.clock.now = (() => NOW + PRESENSI_COOLDOWN_SEC) as never;
    expect(await refreshDetail(deps, 48298, { force: false })).toEqual({ status: 'ok' });
    expect(client.pages).toEqual(['/mod/attendance/view.php?id=197570&mode=1', '/mod/attendance/view.php?id=307194&view=5']);
    expect((await readPresensi(store, 1)).details['307194']?.sessions).toHaveLength(7);
  });

  it('no attendance activity anywhere (structures known, none has one): says so, sends nothing', async () => {
    const { client, deps, store } = await setup();
    const none = (courseId: number) => ({ userId: 1, courseId, fetchedAt: NOW, parserVersion: 1, items: {} });
    await writeUser(store, 1, 'snapshots', { '36673': none(36673), '48298': none(48298) } as never);
    expect(await refreshRecap(deps, { force: true })).toEqual({ status: 'no_attendance' });
    expect(client.pages).toEqual([]);
  });

  it('a page of another shape: "unknown_shape", the old copy stays', async () => {
    const { deps, store } = await setup();
    await refreshRecap(deps, { force: false });
    const before = (await readPresensi(store, 1)).recap;
    deps.client = pageClient(() => ({ kind: 'ok', html: '<html>changed</html>' }));
    deps.clock.now = (() => NOW + PRESENSI_CACHE_SEC) as never;
    expect(await refreshRecap(deps, { force: false })).toEqual({ status: 'unknown_shape' });
    expect((await readPresensi(store, 1)).recap).toEqual(before);
  });

  it('the rules: no cached copy runs, a fresh one waits, the cooldown wins', () => {
    expect(mayRequest(null, null, NOW, false)).toBeNull();
    expect(mayRequest(NOW - 10, null, NOW, false)).toEqual({ status: 'fresh' });
    expect(mayRequest(NOW - 10, null, NOW, true)).toBeNull();
    expect(mayRequest(null, NOW - 10, NOW, true)).toEqual({ status: 'cooldown', retryAt: NOW - 10 + PRESENSI_COOLDOWN_SEC });
    expect(onlyMonitored([{ courseId: 1, cmid: 2, taken: 0, points: null, percent: null }], new Set([3]))).toEqual([]);
  });

  it('no minimum attendance is assumed until it is verified', () => {
    expect(MIN_ATTENDANCE_PERCENT).toBeNull();
  });
});

describe('background sync never touches attendance', () => {
  it('runSync (every automatic trigger and "Perbarui") requests no attendance page, even when courses have one', async () => {
    const stateWithAttendance = () => {
      const state = JSON.parse(fx('courseformat-state.normal')) as { cm: Record<string, unknown>[] };
      state.cm.push({ ...state.cm[0], id: 197570, module: 'attendance', name: 'Presensi', url: 'https://sikola-v2.unhas.ac.id/mod/attendance/view.php?id=197570' });
      return JSON.stringify(state);
    };
    const all = fx('enrolled-courses.normal');
    for (const trigger of ['background', 'startup', 'idle', 'manual', 'onboarding'] as SyncTrigger[]) {
      const pages: string[] = [];
      const batches: string[] = [];
      const client: MoodleClient = {
        async callBatch(calls: readonly MoodleCall[]) {
          batches.push(...calls.map((c) => c.methodname));
          return {
            kind: 'ok',
            results: calls.map((c) => ({
              ok: true,
              data:
                c.methodname === 'core_session_time_remaining' ? { userid: 1, timeremaining: 7200 }
                : c.methodname === 'core_calendar_get_action_events_by_timesort' ? fx('calendar-action-events.normal')
                : c.methodname === 'message_popup_get_popup_notifications' ? fx('popup-notifications.normal')
                : c.methodname === 'core_courseformat_get_state' ? stateWithAttendance()
                : all,
            })),
          };
        },
        async fetchPage(path) {
          pages.push(path);
          return { kind: 'network_error' };
        },
      };
      await runSync({ client, store: memoryStore(), clock: fixedClock('2026-09-22', 10, 1_790_000_000), trigger, idleState: 'active' });
      expect(batches.length, trigger).toBeGreaterThan(0);
      expect(pages, trigger).toEqual([]);
    }
  });
});

// ---------- M7.3 fix: finding the attendance activity ----------

import { courseStatus, diagnose, findRecapCmid, MAX_CMID_PROBES, recordSeenCmid } from '@sulo/core/presensi/service';
import { attendanceCmidFromUrl } from '@sulo/core/presensi/urls';
import { readUser as readUserFor } from '@sulo/core/storage';

/** A course structure answer with or without an attendance activity. */
function stateJson(cmId: number | null) {
  const state = JSON.parse(fx('courseformat-state.normal')) as { cm: Record<string, unknown>[] };
  // The fixture's own attendance activity is removed, so each test decides.
  state.cm = state.cm.filter((c) => c.module !== 'attendance');
  if (cmId !== null) state.cm.push({ ...state.cm[0], id: String(cmId), module: 'attendance', name: 'Presensi', uservisible: true });
  return JSON.stringify(state);
}

/** Records batches (one course structure per POST) and answers pages from fixtures. */
function probeClient(attendanceIn: Record<number, number | null>) {
  const posts: number[] = [];
  const pages: string[] = [];
  const client: MoodleClient = {
    async callBatch(callList) {
      const courseId = callList[0]!.args.courseid as number;
      posts.push(courseId);
      return { kind: 'ok', results: [{ ok: true, data: stateJson(attendanceIn[courseId] ?? null) }] };
    },
    async fetchPage(path) {
      pages.push(path);
      return { kind: 'ok', html: page('attendance-all-courses') };
    },
  };
  return { client, posts, pages };
}

async function bareSetup(monitored: number[], snapshots: Record<string, unknown> = {}, knownCmids: number[] = []) {
  const store = memoryStore();
  await switchUser(store, 1);
  await writeUser(store, 1, 'snapshots', snapshots as never);
  if (knownCmids.length) await writeUser(store, 1, 'presensi', { recap: null, details: {}, lastRequestAt: null, unknownShapeAt: null, knownCmids });
  return { store, monitored: new Set(monitored) };
}

const snap = (courseId: number, items: { cmId: number; module: string; uservisible?: boolean }[]) => ({
  userId: 1, courseId, fetchedAt: NOW, parserVersion: 1,
  items: Object.fromEntries(items.map((i) => [i.cmId, { cmId: i.cmId, module: i.module, name: 'x', sectionId: 1, visible: true, uservisible: i.uservisible ?? true, url: null, firstSeenAt: NOW, missCount: 0 }])),
});

describe('finding an attendance activity for the recap (stop at the first that works)', () => {
  it('a. from the structure of any stored course, followed or not; a hidden one as a last resort', async () => {
    const { store, monitored } = await bareSetup([48298], { '36673': snap(36673, [{ cmId: 197570, module: 'attendance' }]) });
    const { client, posts, pages } = probeClient({});
    const deps = { client, store, clock: fixedClock(), timeZone: TZ, userId: 1, monitored };
    expect(await findRecapCmid(deps, await readPresensi(store, 1), true)).toEqual({ cmid: 197570, via: 'snapshot', probes: 0 });
    expect(await refreshRecap(deps, { force: true })).toEqual({ status: 'ok' });
    expect(posts).toEqual([]);
    expect(pages).toEqual(['/mod/attendance/view.php?id=197570&mode=1']);
    const hidden = await bareSetup([1], { '5': snap(5, [{ cmId: 77, module: 'attendance', uservisible: false }]) });
    expect((await findRecapCmid({ ...deps, store: hidden.store, monitored: hidden.monitored }, await readPresensi(hidden.store, 1), false)).cmid).toBe(77);
  });

  it('b. from a cmid seen before, without a request', async () => {
    const { store, monitored } = await bareSetup([48298], {}, [307194]);
    const { client, posts } = probeClient({});
    expect(await findRecapCmid({ client, store, clock: fixedClock(), timeZone: TZ, userId: 1, monitored }, await readPresensi(store, 1), true)).toEqual({ cmid: 307194, via: 'known', probes: 0 });
    expect(posts).toEqual([]);
  });

  it('c. one course structure at a time, never or longest unchecked first, stops when found', async () => {
    const { store, monitored } = await bareSetup([10, 20, 30, 40]);
    const radar = await readUserFor(store, 1, 'radar');
    await writeUser(store, 1, 'radar', { ...radar, stateCheckedAt: { '10': NOW - 100, '20': NOW - 5000, '30': NOW - 50 } });
    const { client, posts, pages } = probeClient({ 10: 197570 });
    const deps = { client, store, clock: fixedClock(), timeZone: TZ, userId: 1, monitored };
    expect(await refreshRecap(deps, { force: true })).toEqual({ status: 'ok' });
    // 40 never checked, then 20, then 10 (found): 30 is never asked.
    expect(posts).toEqual([40, 20, 10]);
    expect(pages).toEqual(['/mod/attendance/view.php?id=197570&mode=1']);
    expect((await readPresensi(store, 1)).knownCmids?.[0]).toBe(197570);
  });

  it('c. at most 3 course structures per click; a course whose stored structure has none is not asked', async () => {
    const { store, monitored } = await bareSetup([1, 2, 3, 4, 5, 6], { '6': snap(6, [{ cmId: 9, module: 'assign' }]) });
    const { client, posts, pages } = probeClient({});
    const deps = { client, store, clock: fixedClock(), timeZone: TZ, userId: 1, monitored };
    expect(await refreshRecap(deps, { force: true })).toEqual({ status: 'no_attendance' });
    expect(posts).toHaveLength(MAX_CMID_PROBES);
    expect(posts).not.toContain(6);
    expect(pages).toEqual([]);
    // The probes count against the 2-minute cooldown: a second click right away sends nothing.
    expect((await refreshRecap(deps, { force: true })).status).toBe('cooldown');
    expect(posts).toHaveLength(MAX_CMID_PROBES);
  });

  it('d. nothing anywhere: no_attendance, and the probes are recorded for the diagnosis', async () => {
    const { store, monitored } = await bareSetup([1]);
    const { client } = probeClient({});
    expect(await refreshRecap({ client, store, clock: fixedClock(), timeZone: TZ, userId: 1, monitored }, { force: false })).toEqual({ status: 'no_attendance' });
    expect((await readPresensi(store, 1)).lastOutcome).toMatchObject({ status: 'no_attendance', probes: 1 });
  });
});

describe('an attendance page the user opened on SIKOLA', () => {
  it('only the numeric id from the URL', () => {
    expect(attendanceCmidFromUrl('https://sikola-v2.unhas.ac.id/mod/attendance/view.php?id=197570')).toBe(197570);
    expect(attendanceCmidFromUrl('https://sikola-v2.unhas.ac.id/mod/attendance/view.php?id=197570&mode=1')).toBe(197570);
    expect(attendanceCmidFromUrl('https://sikola-v2.unhas.ac.id/mod/attendance/take.php?id=197570')).toBeNull();
    expect(attendanceCmidFromUrl('https://sikola-v2.unhas.ac.id/mod/attendance/view.php?id=abc')).toBeNull();
    expect(attendanceCmidFromUrl('https://evil.example/mod/attendance/view.php?id=1')).toBeNull();
    expect(attendanceCmidFromUrl('https://sikola-v2.unhas.ac.id/course/view.php?id=5')).toBeNull();
  });

  it('is remembered and opens the recap next time', async () => {
    const { store, monitored } = await bareSetup([48298]);
    expect(await recordSeenCmid(store, 1, 307194)).toBe(true);
    const { client, posts, pages } = probeClient({});
    expect(await refreshRecap({ client, store, clock: fixedClock(), timeZone: TZ, userId: 1, monitored }, { force: true })).toEqual({ status: 'ok' });
    expect(posts).toEqual([]);
    expect(pages).toEqual(['/mod/attendance/view.php?id=307194&mode=1']);
  });
});

describe('a followed course before and after the recap', () => {
  const row = { courseId: 1, cmid: 2, taken: 16, points: { got: 31, max: 32 }, percent: 96.9 };
  it('before: "not fetched", never "no attendance"', () => {
    expect(courseStatus(undefined, false)).toBe('not_fetched');
    expect(courseStatus(row, false)).toBe('not_fetched');
  });
  it('after: numbers, no sessions yet, or no attendance when missing from the recap', () => {
    expect(courseStatus(row, true)).toBe('numbers');
    expect(courseStatus({ ...row, taken: 0 }, true)).toBe('no_sessions');
    expect(courseStatus(undefined, true)).toBe('no_module');
  });
  it('diagnosis: snapshot and module counts, recap matching by course id', () => {
    const g = diagnose(
      { '1': snap(1, [{ cmId: 5, module: 'attendance' }, { cmId: 6, module: 'assign' }]) as never, '9': snap(9, [{ cmId: 7, module: 'attendance', uservisible: false }]) as never },
      { recap: { fetchedAt: NOW, rows: [row] }, details: {}, lastRequestAt: null, unknownShapeAt: null, knownCmids: [5] },
      new Set([1, 3]),
    );
    expect(g).toMatchObject({ coursesWithSnapshot: 2, followedWithSnapshot: 1, attendanceModules: 2, attendanceVisible: 1, modulesByName: { attendance: 2, assign: 1 }, recapRows: 1, followedWithNumbers: 1, followedNotInRecap: [3], knownCmids: [5] });
  });
});
