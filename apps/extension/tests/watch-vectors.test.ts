// Shared vectors for the phone's background watching: the TypeScript
// reference (core watch/check.ts) and the Kotlin worker (WatchCheckTest.kt)
// read the same packages/core/src/watch/vectors.json, so CI fails when they
// disagree. Run with UPDATE_WATCH_VECTORS=1 to rewrite the file after a
// deliberate change, then check the diff by hand.
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { afterFailure, buildBatch, detect, emptyOverlay, inQuiet, nextDelayMinutes, notices, numericId, pickRadar, radarDue, radarFits, reserve, watchStopped, type Detected } from '@sulo/core/watch/check';
import { buildWatchPlan } from '@sulo/core/watch/plan';
import { DEFAULT_KEEP_ALIVE } from '@sulo/core/remote/keep-alive';
import { configReadDue, decideRemote, parseConfigResponse } from '@sulo/core/watch/remote';
import { remoteDecideCases, remoteParseCases, remoteReadDueCases } from './watch-remote-cases';

const FILE = new URL('../../../packages/core/src/watch/vectors.json', import.meta.url);
const NOW = 1_795_000_000; // a fixed moment; only differences matter
const H = 3600;

const plan = buildWatchPlan({
  now: NOW - H,
  userId: 4242,
  userEnabled: true,
  keepAlive: DEFAULT_KEEP_ALIVE,
  globalEnabled: true,
  sessionConnected: true,
  remoteRead: { okAt: NOW - 2 * H, readAt: NOW - 2 * H, url: 'https://ikrar06.github.io/sulo-data/config.json' },
  tasks: [
    { eventId: 101, dueAt: NOW + 2 * 86_400, cmId: 501, missingSince: null },
    { eventId: 102, dueAt: NOW + 5 * 86_400, cmId: 502, missingSince: null },
  ],
  calendarBaseline: true,
  notificationLastId: 900,
  radarCourseIds: [11, 12, 13, 14, 15],
  snapshots: { '11': { items: { '501': {}, '601': {} } }, '12': { items: { '502': {} } } },
  announcedCms: [777],
  updates: { materials: true, deadlines: true, grades: true, forum: false },
  quiet: { enabled: true, startMin: 22 * 60, endMin: 6 * 60 },
  courseNames: { '11': 'Hidrologi', '12': 'Mekanika Fluida', '13': 'Statistika', '14': 'Etika Profesi', '15': 'Perencanaan Wilayah' },
  templates: {
    taskAdded: { title: 'Tugas baru: {name}', body: '{course}' },
    dueChanged: { title: 'Tenggat berubah: {name}', body: '{course}' },
    grade: { title: 'Nilai baru keluar untuk {course}', body: 'Buka untuk melihatnya di SIKOLA.' },
    forum: { title: 'Kabar baru di forum {course}', body: '' },
    material: { title: 'Materi baru di {course}', body: '{name}' },
    mixed: { title: '{n} hal baru di {course}', body: 'Buka Sulo untuk melihatnya.' },
    summary: { title: '{n} kabar baru dari {courses} mata kuliah', body: 'Buka Sulo untuk melihat semuanya.' },
    expired: { title: 'Sulo', body: 'Masuk lagi ke SIKOLA supaya Sulo bisa memantau tugas baru.' },
    paused: { title: 'Sulo', body: 'Pemantauan dijeda. Buka Sulo untuk melanjutkan.' },
    otherCourse: 'Mata kuliah lain',
    channel: 'Kabar dari SIKOLA',
  },
});

const ok = (data: unknown) => ({ error: false, data });
const session = ok({ userid: 4242, timeremaining: 7000 });
const event = (id: number, timesort: number, courseId: number, cmId: number | null, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: `${name} is due`,
  activityname: name,
  timesort,
  course: { id: courseId },
  url: cmId === null ? '' : `https://sikola-v2.unhas.ac.id/mod/assign/view.php?id=${cmId}`,
  modulename: 'assign',
  overdue: false,
  ...extra,
});
const calendar = (events: unknown[]) => ok({ events });
const popups = (notifications: unknown[]) => ok({ notifications });
const note = (id: number, component: string, eventtype: string, courseId: number | null) => ({ id, subject: 'x', component, eventtype, timecreated: NOW, read: false, customdata: courseId === null ? null : JSON.stringify({ courseid: courseId }) });
const state = (cms: { id: number; module: string; name: string; visible?: boolean }[]) => ok(JSON.stringify({ cm: cms.map((c) => ({ visible: true, uservisible: true, ...c })) }));
const baseEvents = [event(101, NOW + 2 * 86_400, 11, 501, 'Laporan 1'), event(102, NOW + 5 * 86_400, 12, 502, 'Laporan 2')];

const cases = {
  numericId: ['changes|task:103:added', 'changes_summary|chs:1795000000', 'changes|course:11|chg:11:1795000000', '', 'Tugas baru: Kuis ✓'],
  quiet: [
    { quiet: plan.quiet, minute: 22 * 60 },
    { quiet: plan.quiet, minute: 21 * 60 + 59 },
    { quiet: plan.quiet, minute: 5 * 60 + 59 },
    { quiet: plan.quiet, minute: 6 * 60 },
    { quiet: { enabled: true, startMin: 60, endMin: 120 }, minute: 90 },
    { quiet: { enabled: true, startMin: 60, endMin: 60 }, minute: 60 },
    { quiet: { enabled: false, startMin: 0, endMin: 1439 }, minute: 30 },
  ],
  delay: [
    { minuteOfDay: 6 * 60, powerSave: false, usedToday: 0, callsToday: 0 },
    { minuteOfDay: 5 * 60 + 59, powerSave: false, usedToday: 0, callsToday: 0 },
    { minuteOfDay: 22 * 60 + 59, powerSave: false, usedToday: 10, callsToday: 0 },
    { minuteOfDay: 23 * 60, powerSave: false, usedToday: 10, callsToday: 0 },
    { minuteOfDay: 12 * 60, powerSave: true, usedToday: 10, callsToday: 0 },
    { minuteOfDay: 12 * 60, powerSave: false, usedToday: 80, callsToday: 0 },
    { minuteOfDay: 12 * 60, powerSave: false, usedToday: 79, callsToday: 0 },
    { minuteOfDay: 12 * 60, powerSave: false, usedToday: 150, callsToday: 0 },
    // The watch stop: 100 POST or 700 calls in all (the rest is the reserve for active use).
    { minuteOfDay: 12 * 60, powerSave: false, usedToday: 99, callsToday: 0 },
    { minuteOfDay: 12 * 60, powerSave: false, usedToday: 100, callsToday: 0 },
    { minuteOfDay: 23 * 60 + 30, powerSave: false, usedToday: 100, callsToday: 0 },
    { minuteOfDay: 12 * 60, powerSave: false, usedToday: 40, callsToday: 699 },
    { minuteOfDay: 12 * 60, powerSave: false, usedToday: 40, callsToday: 700 },
  ],
  radarDue: [
    { ctx: { minuteOfDay: 12 * 60, powerSave: false, usedToday: 0, callsToday: 0 }, index: 0 },
    { ctx: { minuteOfDay: 12 * 60, powerSave: false, usedToday: 0, callsToday: 0 }, index: 2 },
    { ctx: { minuteOfDay: 12 * 60, powerSave: false, usedToday: 0, callsToday: 0 }, index: 5 },
    { ctx: { minuteOfDay: 23 * 60 + 30, powerSave: false, usedToday: 0, callsToday: 0 }, index: 2 },
    { ctx: { minuteOfDay: 12 * 60, powerSave: true, usedToday: 0, callsToday: 0 }, index: 2 },
    { ctx: { minuteOfDay: 12 * 60, powerSave: false, usedToday: 80, callsToday: 0 }, index: 2 },
  ],
  radarFits: [
    { callsToday: 0, base: 3, radar: 4 },
    { callsToday: 693, base: 3, radar: 4 },
    { callsToday: 694, base: 3, radar: 4 },
  ],
  stopped: [
    { used: 99, calls: 699 },
    { used: 100, calls: 0 },
    { used: 0, calls: 700 },
  ],
  pickRadar: [
    { courseIds: [11, 12, 13, 14, 15], cursor: 0, max: 4 },
    { courseIds: [11, 12, 13, 14, 15], cursor: 4, max: 4 },
    { courseIds: [11, 12], cursor: 1, max: 4 },
    { courseIds: [], cursor: 3, max: 4 },
  ],
  reserve: [
    { state: null, today: '2026-11-19', now: NOW, calls: 3 },
    { state: { date: '2026-11-18', used: 149, calls: 900 }, today: '2026-11-19', now: NOW, calls: 3 },
    { state: { date: '2026-11-19', used: 150 }, today: '2026-11-19', now: NOW, calls: 3 },
    { state: { date: '2026-11-19', used: 5, calls: 998 }, today: '2026-11-19', now: NOW, calls: 3 },
    { state: { date: '2026-11-19', used: 5, pausedUntil: NOW + 10 }, today: '2026-11-19', now: NOW, calls: 3 },
    { state: { date: '2026-11-19', used: 20, recent: Array.from({ length: 10 }, (_, i) => NOW - 60 * i) }, today: '2026-11-19', now: NOW, calls: 3 },
    // The loop guard: ten requests inside five minutes pause everything for 30 minutes.
    { state: { date: '2026-11-19', used: 20, recent: Array.from({ length: 10 }, (_, i) => NOW - 20 * i) }, today: '2026-11-19', now: NOW, calls: 3 },
    { state: { date: '2026-11-19', used: 20, bySource: { manual: 4, watch: 7 }, withCourseList: 1, calls: 40, recent: [NOW - 400, NOW - 100] }, today: '2026-11-19', now: NOW, calls: 7 },
    // The watch stop leaves the reserve: 100 POST refused, 99 still allowed; calls past 700 refused.
    { state: { date: '2026-11-19', used: 100, bySource: { manual: 60, watch: 40 } }, today: '2026-11-19', now: NOW, calls: 3 },
    { state: { date: '2026-11-19', used: 99, bySource: { manual: 60, watch: 39 } }, today: '2026-11-19', now: NOW, calls: 3 },
    { state: { date: '2026-11-19', used: 50, calls: 698 }, today: '2026-11-19', now: NOW, calls: 3 },
    { state: { date: '2026-11-19', used: 50, calls: 697 }, today: '2026-11-19', now: NOW, calls: 3 },
  ],
  backoff: [
    { prev: null, now: NOW, retryAfter: null, random: 1 },
    { prev: null, now: NOW, retryAfter: null, random: 0 },
    { prev: { failures: 1, nextAllowedAt: NOW }, now: NOW, retryAfter: null, random: 0.5 },
    { prev: { failures: 4, nextAllowedAt: NOW }, now: NOW, retryAfter: null, random: 1 },
    { prev: { failures: 0, nextAllowedAt: 0 }, now: NOW, retryAfter: 30 * H, random: 1 },
    { prev: { failures: 0, nextAllowedAt: 0 }, now: NOW, retryAfter: 5 * H, random: 0 },
  ],
  batch: [
    { now: NOW, radarIds: [] },
    { now: NOW, radarIds: [13, 14] },
  ],
  detect: [
    // Nothing new.
    { name: 'quiet', overlay: emptyOverlay(), radarIds: [], results: [session, calendar(baseEvents), popups([note(900, 'mod_forum', 'posts', 11)])] },
    // A new task, a moved deadline, a grade, a forum post (forum is off), an unknown kind.
    {
      name: 'mixed',
      overlay: emptyOverlay(),
      radarIds: [],
      results: [
        session,
        calendar([event(101, NOW + 3 * 86_400, 11, 501, 'Laporan 1'), baseEvents[1], event(103, NOW + 86_400, 11, 503, 'Kuis 3')]),
        popups([note(902, 'mod_assign', 'assign_notification', 12), note(901, 'mod_forum', 'posts', 11), note(903, 'moodle', 'something_else', 13)]),
      ],
    },
    // A far task and an already-announced activity stay quiet; the overlay keeps them from repeating.
    {
      name: 'far-and-announced',
      overlay: { eventIds: [104], dueKeys: [], notificationLastId: 905, cms: {} },
      radarIds: [],
      results: [session, calendar([...baseEvents, event(104, NOW + 86_400, 11, 504, 'Sudah'), event(105, NOW + 100 * 86_400, 12, 505, 'Jauh'), event(106, NOW + 86_400, 12, 777, 'Diumumkan')]), popups([note(904, 'mod_assign', 'assign_notification', 12)])],
    },
    // Radar: new material, a label, a hidden one, a task activity, and the same cm as a new task in this answer.
    {
      name: 'radar',
      overlay: emptyOverlay(),
      radarIds: [11, 13],
      results: [
        session,
        calendar([...baseEvents, event(107, NOW + 86_400, 11, 603, 'Tugas Baru')]),
        popups([]),
        state([
          { id: 501, module: 'assign', name: 'Laporan 1' },
          { id: 601, module: 'resource', name: 'Modul 1' },
          { id: 602, module: 'resource', name: 'Modul 2' },
          { id: 603, module: 'assign', name: 'Tugas Baru' },
          { id: 604, module: 'label', name: 'Label' },
          { id: 605, module: 'resource', name: 'Tersembunyi', visible: false },
          { id: 606, module: 'quiz', name: 'Kuis Baru' },
        ]),
        state([{ id: 700, module: 'resource', name: 'Tanpa baseline' }]),
      ],
    },
    // The session ended; another account; a call error; a wrong shape.
    { name: 'expired', overlay: emptyOverlay(), radarIds: [], results: [{ error: true, exception: { errorcode: 'servicerequireslogin' } }, calendar([]), popups([])] },
    { name: 'other-account', overlay: emptyOverlay(), radarIds: [], results: [ok({ userid: 1, timeremaining: 1 }), calendar([]), popups([])] },
    { name: 'call-error', overlay: emptyOverlay(), radarIds: [], results: [session, { error: true, exception: { errorcode: 'x' } }, popups([])] },
    { name: 'bad-shape', overlay: emptyOverlay(), radarIds: [], results: [session, ok({ events: [{ id: 'x' }] }), popups([])] },
    { name: 'wrong-length', overlay: emptyOverlay(), radarIds: [11], results: [session, calendar([]), popups([])] },
    // Moodle stopped the batch at a Radar course it would not open (20 Nov 2026): no notice, no session end.
    { name: 'moodle-stopped-at-a-course', overlay: emptyOverlay(), radarIds: [11, 13], results: [session, calendar([]), popups([]), { error: true, exception: { errorcode: 'requireloginerror' } }] },
  ],
};

const d = (kind: Detected['kind'], courseId: number | null, extra: Record<string, unknown>): Detected => ({ kind, courseId, key: `${kind}:${JSON.stringify(extra)}`, eventId: 1, cmId: 1, name: 'Nama', notificationId: 1, ...extra }) as Detected;
const noticeCases = [
  { name: 'one-task', changes: [d('task_added', 11, { key: 'task:103:added', name: 'Kuis 3' })], held: [], minute: 12 * 60 },
  { name: 'per-course', changes: [d('task_added', 11, { key: 'task:103:added', name: 'Kuis 3' }), d('grade_feedback', 12, { key: 'note:902' }), d('material', 11, { key: 'cm:11:602:added', name: 'Modul 2' })], held: [], minute: 12 * 60 },
  { name: 'unknown-course', changes: [d('forum', null, { key: 'note:950' })], held: [], minute: 12 * 60 },
  { name: 'four-courses', changes: [11, 12, 13, 14].map((c) => d('material', c, { key: `cm:${c}:1:added`, name: 'M' })), held: [], minute: 12 * 60 },
  { name: 'quiet-holds', changes: [d('due_changed', 12, { key: 'task:102:due:1', name: 'Laporan 2' })], held: [], minute: 23 * 60 },
  { name: 'after-quiet', changes: [], held: [d('due_changed', 12, { key: 'task:102:due:1', name: 'Laporan 2' })], minute: 6 * 60 + 5 },
  { name: 'long-name', changes: [d('task_added', 12, { key: 'task:108:added', name: 'Analisis kestabilan lereng dengan metode irisan dan perbandingan hasil terhadap perangkat lunak' })], held: [], minute: 12 * 60 },
];

function compute() {
  return {
    plan,
    numericId: cases.numericId.map((id) => ({ id, out: numericId(id) })),
    quiet: cases.quiet.map((c) => ({ ...c, out: inQuiet(c.minute, c.quiet) })),
    delay: cases.delay.map((ctx) => ({ ctx, out: nextDelayMinutes(plan, ctx) })),
    radarDue: cases.radarDue.map((c) => ({ ...c, out: radarDue(plan, c.ctx, c.index) })),
    radarFits: cases.radarFits.map((c) => ({ ...c, out: radarFits(plan, c.callsToday, c.base, c.radar) })),
    stopped: cases.stopped.map((c) => ({ ...c, out: watchStopped(plan, c.used, c.calls) })),
    pickRadar: cases.pickRadar.map((c) => ({ ...c, out: pickRadar(c.courseIds, c.cursor, c.max) })),
    reserve: cases.reserve.map((c) => ({ ...c, out: reserve(c.state as never, c.today, c.now, c.calls, plan) })),
    backoff: cases.backoff.map((c) => ({ ...c, out: afterFailure(c.prev, c.now, c.retryAfter, c.random) })),
    batch: cases.batch.map((c) => ({ ...c, out: buildBatch(plan, c.now, c.radarIds) })),
    detect: cases.detect.map((c) => ({ ...c, now: NOW, out: detect(plan, c.overlay, NOW, c.results, c.radarIds) })),
    notices: noticeCases.map((c) => ({ ...c, now: NOW, out: notices(plan, c.changes, c.held, NOW, c.minute) })),
    // The worker's own config reading (watch/remote.ts, WatchRemote.kt).
    remoteParse: remoteParseCases.map(({ want: _, ...c }) => ({ ...c, out: parseConfigResponse(c.status, c.body) })),
    remoteReadDue: remoteReadDueCases.map(({ want: _, ...c }) => ({ ...c, out: configReadDue(c.lastReadAt, c.now) })),
    remoteDecide: remoteDecideCases.map(({ want: _, ...c }) => ({ ...c, out: decideRemote(c.state) })),
  };
}

describe('watch shared vectors', () => {
  const fresh = JSON.parse(JSON.stringify(compute()));
  if (process.env.UPDATE_WATCH_VECTORS === '1') writeFileSync(FILE, `${JSON.stringify(fresh, null, 1)}\n`);
  it('the reference still gives the stored vectors (Kotlin reads the same file)', () => {
    expect(JSON.parse(readFileSync(FILE, 'utf8'))).toEqual(fresh);
  });
  it('the worker reads the config as the rules say (every remote case)', () => {
    for (const c of remoteParseCases) expect([c.name, parseConfigResponse(c.status, c.body)]).toEqual([c.name, c.want]);
    for (const c of remoteReadDueCases) expect(configReadDue(c.lastReadAt, c.now)).toBe(c.want);
    for (const c of remoteDecideCases) expect([c.name, decideRemote(c.state)]).toEqual([c.name, c.want]);
  });
  it('key cases read as intended', () => {
    const byName = Object.fromEntries(fresh.detect.map((c: { name: string; out: unknown }) => [c.name, c.out]));
    expect(byName.quiet).toMatchObject({ status: 'ok', changes: [] });
    expect(byName.mixed.changes.map((c: { key: string }) => c.key)).toEqual(['task:101:due:' + (NOW + 3 * 86_400), 'task:103:added', 'note:902']);
    expect(byName['far-and-announced'].changes).toEqual([]);
    expect(byName.radar.changes.map((c: { key: string; kind: string }) => `${c.kind} ${c.key}`)).toEqual(['task_added task:107:added', 'material cm:11:602:added', 'task_activity cm:11:606:added']);
    expect(byName.expired).toEqual({ status: 'expired' });
    for (const n of ['other-account', 'call-error', 'bad-shape', 'wrong-length', 'moodle-stopped-at-a-course']) expect(byName[n]).toEqual({ status: 'unsure' });
    const notes = Object.fromEntries(fresh.notices.map((c: { name: string; out: unknown }) => [c.name, c.out]));
    expect(notes['one-task'].send[0]).toMatchObject({ id: 'changes|task:103:added', title: 'Tugas baru: Kuis 3', body: 'Hidrologi' });
    expect(notes['per-course'].send.map((s: { title: string }) => s.title)).toEqual(['2 hal baru di Hidrologi', 'Nilai baru keluar untuk Mekanika Fluida']);
    expect(notes['four-courses'].send).toHaveLength(1);
    expect(notes['quiet-holds']).toMatchObject({ send: [], hold: [{ key: 'task:102:due:1' }] });
    expect(notes['after-quiet'].send[0].title).toBe('1 kabar baru dari 1 mata kuliah');
    expect(fresh.reserve[6].out).toMatchObject({ ok: false, next: { pausedUntil: NOW + 30 * 60 } });
    expect(fresh.plan.budget).toMatchObject({ softPosts: 80, watchStopPosts: 100, watchStopCalls: 700, hardPosts: 150, callLimit: 1000 });
    expect(fresh.delay.map((c: { out: number | null }) => c.out)).toEqual([20, 60, 20, 60, 60, 40, 20, null, 40, null, null, 20, null]);
    expect(fresh.reserve.slice(8).map((c: { out: { ok: boolean } }) => c.out.ok)).toEqual([false, true, false, true]);
    expect(fresh.radarFits.map((c: { out: boolean }) => c.out)).toEqual([true, true, false]);
    expect(fresh.stopped.map((c: { out: boolean }) => c.out)).toEqual([false, true, true]);
    expect(fresh.radarDue.map((c: { out: boolean }) => c.out)).toEqual([false, true, true, false, false, false]);
  });
});
