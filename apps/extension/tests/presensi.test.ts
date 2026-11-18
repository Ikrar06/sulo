import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MoodleCall } from '@sulo/core/moodle/calls';
import { createMoodleClient, type MoodleClient, type PageOutcome } from '@sulo/core/moodle/client';
import { parseDetail, parseRecap, statusOf } from '@sulo/core/presensi/parse';
import { MIN_ATTENDANCE_PERCENT, PRESENSI_CACHE_SEC, PRESENSI_COOLDOWN_SEC } from '@sulo/core/presensi/rules';
import { attendanceCmids, averagePercent, lowestBelowAverage, mayRequest, onlyMonitored, readPresensi, refreshDetail, refreshRecap, type PresensiDeps } from '@sulo/core/presensi/service';
import { detailPath, isReadOnlyAttendanceUrl, recapPath } from '@sulo/core/presensi/urls';
import { pageUserId } from '@sulo/core/presensi/page-user';
import { ACCOUNT_PENDING_KEY } from '@sulo/core/account/pending';
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
    deps.client = pageClient(() => ({ kind: 'ok', html: '<html><div data-userid="1"></div>changed</html>' }));
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

describe("automatic recap in syncs (owner's rule of 18 Nov 2026)", () => {
  const all = fx('enrolled-courses.normal');
  const state = (withAttendance: boolean) => {
    const st = JSON.parse(fx('courseformat-state.normal')) as { cm: Record<string, unknown>[] };
    if (!withAttendance) st.cm = st.cm.filter((c) => c.module !== 'attendance');
    return JSON.stringify(st);
  };
  /** Answers every batch from fixtures; pages: the recap (or a failure). */
  function syncClient(opts: { attendanceInState?: boolean; recapFails?: boolean } = {}) {
    const pages: string[] = [];
    const stateCalls: number[] = [];
    const client: MoodleClient = {
      async callBatch(calls: readonly MoodleCall[]) {
        return {
          kind: 'ok',
          results: calls.map((c) => {
            if (c.methodname === 'core_courseformat_get_state') stateCalls.push(c.args.courseid as number);
            return {
              ok: true,
              data:
                c.methodname === 'core_session_time_remaining' ? { userid: 1, timeremaining: 7200 }
                : c.methodname === 'core_calendar_get_action_events_by_timesort' ? fx('calendar-action-events.normal')
                : c.methodname === 'message_popup_get_popup_notifications' ? fx('popup-notifications.normal')
                : c.methodname === 'core_courseformat_get_state' ? state(opts.attendanceInState ?? true)
                : c.args.classification === 'inprogress' ? { courses: all.courses.filter((x: { id: number }) => [401, 402, 403].includes(x.id)), nextoffset: 3 } : all,
            };
          }),
        };
      },
      async fetchPage(path) {
        pages.push(path);
        return opts.recapFails ? { kind: 'http_error', status: 500 } : { kind: 'ok', html: page('attendance-all-courses') };
      },
    };
    return { client, pages, stateCalls };
  }
  const at = (h: number) => fixedClock('2026-09-22', 10, 1_790_000_000 + h * 3600);
  const sync = (client: MoodleClient, store: ReturnType<typeof memoryStore>, h: number, trigger: SyncTrigger = 'background') => runSync({ client, store, clock: at(h), trigger, idleState: 'active' });

  it('the first sync after connecting fetches the recap; within 24 hours no more; after that once', async () => {
    const store = memoryStore();
    const { client, pages } = syncClient();
    await sync(client, store, 0, 'onboarding');
    expect(pages.filter((p) => p.includes('mode=1'))).toHaveLength(1);
    await sync(client, store, 4);
    await sync(client, store, 8, 'manual');
    expect(pages.filter((p) => p.includes('mode=1'))).toHaveLength(1);
    await sync(client, store, 24);
    await sync(client, store, 28);
    expect(pages.filter((p) => p.includes('mode=1'))).toHaveLength(2);
  });

  it('details are never fetched in a sync', async () => {
    const store = memoryStore();
    const { client, pages } = syncClient();
    for (const [h, t] of [[0, 'onboarding'], [4, 'background'], [26, 'manual'], [30, 'startup']] as const) await sync(client, store, h, t);
    expect(pages.every((p) => p.includes('mode=1'))).toBe(true);
    expect(pages.some((p) => p.includes('view=5'))).toBe(false);
  });

  it('saver mode skips the automatic recap', async () => {
    const store = memoryStore();
    const { client, pages } = syncClient();
    await sync(client, store, 0, 'onboarding');
    const { BUDGET_KEY } = await import('@sulo/core/moodle/budget');
    await store.set(BUDGET_KEY, { date: '2026-09-22', used: 90, calls: 200 });
    await sync(client, store, 25);
    expect(pages.filter((p) => p.includes('mode=1'))).toHaveLength(1);
  });

  it('a failing recap never fails the task sync', async () => {
    const store = memoryStore();
    const { client, pages } = syncClient({ recapFails: true });
    const outcome = await sync(client, store, 0, 'onboarding');
    expect(outcome.status).toBe('ok');
    expect(pages).toHaveLength(1);
    expect((await readPresensi(store, 1)).recap).toBeNull();
  });

  it('at most 1 extra course structure, only in the first sync; later syncs wait for the radar', async () => {
    const store = memoryStore();
    const { client, pages, stateCalls } = syncClient({ attendanceInState: false });
    await sync(client, store, 0, 'onboarding');
    // The radar follow-up stores the structures (no attendance there); then 1 probe at most.
    const firstSyncStates = stateCalls.length;
    expect(pages).toEqual([]);
    await sync(client, store, 25);
    expect(stateCalls.length - firstSyncStates).toBeLessThanOrEqual(4);
    // No probe outside the first sync: the radar's own turn is the only source of structures.
    expect(pages).toEqual([]);
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
    // Each fetched structure is kept for the radar, as a silent baseline.
    const stored = await readUserFor(store, 1, 'snapshots');
    expect(Object.keys(stored).map(Number).sort()).toEqual([...posts, 6].sort());
    expect(await readUserFor(store, 1, 'changes')).toEqual([]);
    expect(Object.keys((await readUserFor(store, 1, 'radar')).stateCheckedAt).map(Number).sort()).toEqual([...posts].sort());
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

describe('probe limits by caller', () => {
  it("an account's first sync probes at most 1 course structure; other syncs none; a click up to 3", async () => {
    for (const [limit, expected] of [[1, 1], [0, 0], [3, 3]] as const) {
      const { store, monitored } = await bareSetup([1, 2, 3, 4, 5]);
      const { client, posts } = probeClient({});
      await findRecapCmid({ client, store, clock: fixedClock(), timeZone: TZ, userId: 1, monitored }, await readPresensi(store, 1), limit);
      expect(posts, `limit ${limit}`).toHaveLength(expected);
    }
  });
});

describe('details from a real SIKOLA page (sanitized: name, remarks)', () => {
  const parsed = parseDetail(page('attendance-course-sessions'), TZ);
  it('golden', async () => {
    expect(parsed.kind).toBe('ok');
    await expect(`${JSON.stringify(parsed, null, 2)}\n`).toMatchFileSnapshot('../fixtures/presensi/golden/detail-real.json');
  });
  it('reads every session: date and time from one cell, status, points', () => {
    if (parsed.kind !== 'ok') throw new Error('shape');
    expect(parsed.value.length).toBeGreaterThan(0);
    expect(parsed.value[0]).toMatchObject({ dateText: 'Thu 20 Aug 2026', timeText: '7:50AM - 10:20AM', description: 'Pertemuan ke-1', status: 'present', points: { got: 2, max: 2 } });
    // 20 August 2026, 07.50 WITA.
    expect(parsed.value[0]!.at).toBe(Date.UTC(2026, 7, 19, 23, 50) / 1000);
    expect(parsed.value.every((s) => s.at !== null && s.status !== 'unknown')).toBe(true);
    expect(new Set(parsed.value.map((s) => s.status))).toEqual(new Set(['present', 'late', 'absent']));
  });
});

describe('details: per-course cooldown and when the cooldown line shows', () => {
  it('opening details right after the recap is not blocked; each course has its own 2 minutes', async () => {
    const { client, deps } = await setup();
    await refreshRecap(deps, { force: false });
    // Same second: the recap's cooldown does not hold details back.
    expect(await refreshDetail(deps, 36673, { force: false })).toEqual({ status: 'ok' });
    expect(await refreshDetail(deps, 48298, { force: false })).toEqual({ status: 'ok' });
    // Perbarui on the same course at once: its own cooldown.
    expect((await refreshDetail(deps, 36673, { force: true })).status).toBe('cooldown');
    expect(client.pages.filter((p) => p.includes('view=5'))).toHaveLength(2);
  });

  it('opening a view never reports "cooldown" for fresh data; it reports "fresh"', async () => {
    const { deps } = await setup();
    await refreshRecap(deps, { force: false });
    expect(await refreshRecap(deps, { force: false })).toEqual({ status: 'fresh' });
  });
});

describe('Studi card: lowest course below the average', () => {
  const row = (courseId: number, got: number, max: number, taken = 1) => ({ courseId, cmid: courseId + 1000, taken, points: { got, max }, percent: max > 0 ? Math.round((got / max) * 1000) / 10 : null });
  it('names the lowest course when it is below the average', () => {
    const rows = [row(1, 10, 10), row(2, 6, 10), row(3, 9, 10)];
    expect(averagePercent(rows)).toBe(83.3);
    expect(lowestBelowAverage(rows)).toEqual({ courseId: 2, percent: 60 });
  });
  it('no line when every course is at the average, without sessions, or without data', () => {
    expect(lowestBelowAverage([row(1, 5, 5), row(2, 4, 4)])).toBeNull();
    expect(lowestBelowAverage([row(1, 5, 5), row(2, 0, 0, 0)])).toBeNull();
    expect(lowestBelowAverage([])).toBeNull();
  });
});

describe('a fetched attendance page must answer for the active account', () => {
  const withUser = (html: string, id: number | null) => html.replace(/<div class="popover-region" data-userid="1"><\/div>\n/, id === null ? '' : `<div class="popover-region" data-userid="${id}"></div>\n`);
  const recapHtml = page('attendance-all-courses');
  const detailHtml = page('attendance-course-sessions.synthetic');

  async function run(target: 'recap' | 'detail', id: number | null) {
    const { store, deps } = await setup();
    // Details need the recap first (its cmid); that one is the account's own.
    if (target === 'detail') await refreshRecap(deps, { force: false });
    const before = await readPresensi(store, 1);
    deps.client = pageClient((p) => ({ kind: 'ok', html: p.includes('mode=1') ? withUser(recapHtml, id) : withUser(detailHtml, id) }));
    const outcome = target === 'recap' ? await refreshRecap(deps, { force: true }) : await refreshDetail(deps, 36673, { force: false });
    return { outcome, before, after: await readPresensi(store, 1), pending: await store.get(ACCOUNT_PENDING_KEY) };
  }

  for (const target of ['recap', 'detail'] as const) {
    it(`${target}: same account, stored`, async () => {
      const { outcome, after, pending } = await run(target, 1);
      expect(outcome).toEqual({ status: 'ok' });
      expect(target === 'recap' ? after.recap?.rows.length : Object.keys(after.details).length).toBeGreaterThan(0);
      expect(pending).toBeUndefined();
    });

    it(`${target}: another account, nothing stored and the switch is marked`, async () => {
      const { outcome, before, after, pending } = await run(target, 2);
      expect(outcome).toEqual({ status: 'account_mismatch' });
      expect(after.recap).toEqual(before.recap);
      expect(after.details).toEqual(before.details);
      expect(after.lastOutcome).toEqual(before.lastOutcome);
      expect(pending).toMatchObject({ userId: 2 });
    });

    it(`${target}: no account on the page, nothing stored, "user_unverified" for the diagnosis`, async () => {
      const { outcome, before, after, pending } = await run(target, null);
      expect(outcome).toEqual({ status: 'user_unverified' });
      expect(after.recap).toEqual(before.recap);
      expect(after.details).toEqual(before.details);
      expect(after.lastOutcome?.status).toBe('user_unverified');
      expect(pending).toBeUndefined();
    });
  }

  it('the automatic recap without an account on the page is tried again in the next sync', async () => {
    const { store, deps } = await setup();
    deps.client = pageClient(() => ({ kind: 'ok', html: withUser(recapHtml, null) }));
    expect(await refreshRecap(deps, { force: false, maxProbes: 0 })).toEqual({ status: 'user_unverified' });
    // Still no recap: the next sync (past the 2-minute cooldown) asks again.
    expect((await readPresensi(store, 1)).recap).toBeNull();
  });
});

describe('reading the account id of a page (numbers only)', () => {
  it('data-userid first, then M.cfg, then the profile link', () => {
    expect(pageUserId('<div data-userid="7"></div><section id="region-main"></section>')).toBe(7);
    expect(pageUserId('<script>M.cfg = {"wwwroot":"x","userId":8};</script><section id="region-main"></section>')).toBe(8);
    expect(pageUserId('<a href="/user/profile.php?id=9">Profil</a><section id="region-main"></section>')).toBe(9);
    expect(pageUserId('<div data-userid="7"></div><a href="/user/profile.php?id=9"></a>')).toBe(7);
  });

  it('ids inside the main region (other people) are ignored; disagreeing ids give none', () => {
    expect(pageUserId('<section id="region-main"><div data-userid="5"></div><a href="/user/profile.php?id=6"></a></section>')).toBeNull();
    expect(pageUserId('<div data-userid="7"></div><div data-userid="8"></div><section id="region-main"></section>')).toBeNull();
    expect(pageUserId('<div data-userid="abc"></div><section id="region-main"></section>')).toBeNull();
  });

  it('every sanitized attendance fixture carries the synthetic account', () => {
    for (const name of ['attendance-all-courses', 'attendance-course', 'attendance-course-sessions', 'attendance-course-sessions.synthetic']) expect(pageUserId(page(name))).toBe(1);
  });
});
