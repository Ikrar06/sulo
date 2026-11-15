// Preview data built from the synthetic fixtures through the real pipeline
// (Zod schemas, buildCourses, mergeTasks, buildPopupView). Dev builds only.

import calendarFx from '@/fixtures/synthetic/calendar-action-events.normal.json';
import enrolledFx from '@/fixtures/synthetic/enrolled-courses.normal.json';
import { buildCourses } from '@/lib/courses/build';
import { appendChanges } from '@/lib/radar/log';
import { DAILY_BUDGET } from '@/lib/moodle/limits';
import { parseCall } from '@/lib/moodle/schemas';
import { DEFAULT_REMOTE_CONFIG } from '@/lib/remote/remote-config';
import { DEFAULT_SYNC_STATUS, DEFAULTS, type UserData } from '@/lib/storage';
import { mergeTasks, upcomingCourseIds } from '@/lib/tasks/from-calendar';
import type { CourseRecord, Task } from '@/lib/types';
import { buildPopupView, type PopupInput, type PopupView } from '@/lib/view/popup-view';

export const TZ = 'Asia/Makassar';
// Fixed "now" so the preview is reproducible: Tue 22 Sep 2026, 12.00 WITA.
export const NOW = Date.UTC(2026, 8, 22, 4, 0) / 1000;
const HOUR = 3600;
const DAY = 86_400;

function parsedFixtures() {
  const cal = parseCall('core_calendar_get_action_events_by_timesort', { ok: true, data: calendarFx });
  const all = parseCall('core_course_get_enrolled_courses_by_timeline_classification', { ok: true, data: enrolledFx });
  if (!cal.ok || !all.ok) throw new Error('synthetic fixtures do not match the schemas');
  return { events: cal.data.events, courses: all.data.courses };
}

/** Real pipeline, with due dates moved around NOW so every group appears. */
function baseUser(): UserData {
  const { events, courses } = parsedFixtures();
  const shifted = events.map((e, i) => ({ ...e, timesort: NOW + [-5 * HOUR, 20 * HOUR, 4 * DAY][i]! }));
  const tasks = mergeTasks([], shifted, NOW, 14);
  const extra: Task[] = [
    { ...tasks[0]!, eventId: 901, courseId: 401, name: 'Laporan praktikum aliran fluida pada saluran terbuka dengan variasi debit dan kemiringan', dueAt: NOW + 2 * HOUR },
    { ...tasks[1]!, eventId: 902, courseId: 402, name: 'Tugas besar perencanaan', dueAt: NOW + 12 * DAY },
    { ...tasks[2]!, eventId: 903, courseId: 403, name: 'Refleksi etika profesi', dueAt: null },
    { ...tasks[2]!, eventId: 904, courseId: 404, name: 'Tugas dari mata kuliah lama', dueAt: NOW + DAY },
    { ...tasks[2]!, eventId: 905, courseId: 401, name: 'Kuis yang sudah dikumpulkan', dueAt: NOW + DAY, missingSince: NOW - DAY },
  ];
  const allTasks = [...tasks, ...extra];
  const built = buildCourses({
    all: courses,
    inProgressIds: new Set([401, 402, 403, 405]),
    upcomingCourseIds: upcomingCourseIds(allTasks, NOW),
    previous: [],
    now: NOW,
  });
  // A few updates for the "Kabar terbaru" panel and the row markers.
  const t0 = allTasks[0]!;
  const t1 = allTasks[1]!;
  const yesterday = appendChanges([], [
    { kind: 'added', courseId: 402, cmId: 7001, module: 'resource', name: 'Modul 6: Analisis lalu lintas', url: 'https://sikola-v2.unhas.ac.id/mod/resource/view.php?id=7001', since: NOW - 30 * HOUR },
    { kind: 'renamed', courseId: 402, cmId: 7002, module: 'page', from: 'Materi 5', to: 'Materi 5 (revisi)', url: null, since: NOW - 30 * HOUR },
  ], NOW - 26 * HOUR).map((e) => ({ ...e, seen: true }));
  const changes = appendChanges(yesterday, [
    { kind: 'task_added', courseId: t1.courseId, eventId: t1.eventId, cmId: t1.cmId, name: t1.name, dueAt: t1.dueAt, url: t1.url },
    { kind: 'due_changed', courseId: t0.courseId, eventId: t0.eventId, cmId: t0.cmId, name: t0.name, from: (t0.dueAt ?? NOW) - 2 * DAY, to: t0.dueAt, url: t0.url },
    { kind: 'grade_feedback', courseId: 403, notification: { id: 701, subject: 'Tugas sudah dinilai', component: 'mod_assign', eventtype: 'assign_notification', timecreated: NOW - HOUR, read: false, contexturl: 'https://sikola-v2.unhas.ac.id/mod/assign/view.php?id=901' } },
  ], NOW - HOUR);
  return {
    ...DEFAULTS,
    changes,
    courses: built,
    tasks: allTasks,
    sync: { lastSyncAt: NOW - 5 * 60, lastCourseListAt: NOW - HOUR },
    onboarding: { completedAt: NOW - 7 * DAY, confirmedInProgress: [401, 402, 403, 405], reviewSuggested: [] },
  };
}

const input = (patch: Partial<PopupInput> = {}): PopupInput => ({
  user: baseUser(),
  session: 'OK',
  syncStatus: DEFAULT_SYNC_STATUS,
  remoteConfig: DEFAULT_REMOTE_CONFIG,
  budget: { date: '2026-09-22', used: 6, bySource: { background: 3, popup: 2, onboarding: 1 }, withCourseList: 1 },
  budgetLimit: DAILY_BUDGET,
  now: NOW,
  timeZone: TZ,
  ...patch,
});

function manyTasksUser(): UserData {
  const u = baseUser();
  const long = 'Analisis kestabilan lereng dengan metode irisan dan perbandingan hasil terhadap perangkat lunak geoteknik';
  const tasks: Task[] = Array.from({ length: 34 }, (_, i) => ({
    ...u.tasks[0]!,
    eventId: 2000 + i,
    courseId: [401, 402, 403, 405][i % 4]!,
    name: i % 5 === 0 ? `${long} bagian ${i + 1}` : `Tugas ${i + 1}`,
    dueAt: NOW + (i - 3) * 9 * HOUR,
    missingSince: null,
  }));
  return { ...u, tasks };
}

const withView = (input: PopupInput): { input: PopupInput; view: PopupView } => ({ input, view: buildPopupView(input) });

export const POPUP_STATES: { title: string; input: PopupInput; view: PopupView }[] = [
  { title: 'Normal (semua kelompok)', ...withView(input()) },
  { title: 'Belum onboarding', ...withView(input({ user: null })) },
  { title: 'Kosong (semua beres)', ...withView(input({ user: { ...baseUser(), tasks: [] } })) },
  { title: 'Satu tugas', ...withView(input({ user: { ...baseUser(), tasks: baseUser().tasks.slice(1, 2) } })) },
  { title: 'Lebih dari 30 tugas, nama panjang', ...withView(input({ user: manyTasksUser() })) },
  { title: 'Sedang sinkron', ...withView(input({ syncing: true })) },
  { title: 'Sesi habis', ...withView(input({ session: 'EXPIRED' })) },
  { title: 'Parser rusak', ...withView(input({ syncStatus: { ...DEFAULT_SYNC_STATUS, lastOutcome: { status: 'parser_broken', where: 'core_calendar_get_action_events_by_timesort' } } })) },
  { title: 'Batas harian', ...withView(input({ budget: { date: '2026-09-22', used: DAILY_BUDGET } })) },
  { title: 'Dimatikan dari jauh', ...withView(input({ remoteConfig: { ...DEFAULT_REMOTE_CONFIG, enabled: false, message: 'Sulo dijeda sementara atas permintaan pengelola.' } })) },
  { title: 'Offline', ...withView(input({ syncStatus: { ...DEFAULT_SYNC_STATUS, lastOutcome: { status: 'offline' } } })) },
  { title: 'Data basi', ...withView(input({ user: { ...baseUser(), sync: { lastSyncAt: NOW - 9 * HOUR, lastCourseListAt: null } } })) },
  {
    title: 'Semester baru terdeteksi',
    ...withView(input({ user: { ...baseUser(), onboarding: { completedAt: NOW - DAY, confirmedInProgress: [401], reviewSuggested: [402, 403] } } })),
  },
];

/** 50 courses with real-pattern names (invented), for the onboarding list. */
export function manyCourses(): CourseRecord[] {
  const base = baseUser().courses;
  const names = [
    'MEKANIKA TANAH II', 'HIDROLOGI TERAPAN', 'STRUKTUR BETON BERTULANG I', 'PERENCANAAN TRANSPORTASI', 'MANAJEMEN KONSTRUKSI',
    'ANALISIS NUMERIK', 'GAMBAR REKAYASA', 'BAHASA INDONESIA', 'PENDIDIKAN PANCASILA', 'FISIKA DASAR II',
    'TEKNIK PONDASI', 'IRIGASI DAN BANGUNAN AIR', 'REKAYASA LALU LINTAS', 'BAJA STRUKTURAL', 'KEWIRAUSAHAAN',
    'PENGANTAR LINGKUNGAN BMI', 'STATISTIKA DAN PROBABILITAS', 'DINAMIKA STRUKTUR', 'GEOLOGI TEKNIK', 'ETIKA PROFESI DAN KOMUNIKASI',
    'KALKULUS III', 'MEKANIKA FLUIDA', 'PERKERASAN JALAN', 'METODE PELAKSANAAN KONSTRUKSI YANG BERKELANJUTAN DALAM WILAYAH PESISIR', 'ILMU UKUR TANAH',
  ];
  return Array.from({ length: 50 }, (_, i) => {
    const template = base[i % base.length]!;
    const name = names[i % names.length]!;
    const cls = 'ABCD'[i % 4]!;
    const active = i < 11;
    return {
      ...template,
      id: 5000 + i,
      fullname: `${name} ${cls}${i % 3 === 0 ? ' (TEKNIK SIPIL)' : ''} [23D0${String(1000000 + i).slice(1)}]`,
      parsed: { name, classLetter: cls, program: i % 3 === 0 ? 'TEKNIK SIPIL' : null, code: `23D0${String(1000000 + i).slice(1)}`, matched: true },
      inProgress: active,
      past: !active,
      activeScore: active ? 6 + (i % 2) * 2 : -7,
      activeReasons: active ? (i % 2 ? ['inprogress', 'enddate_future', 'upcoming_events'] : ['inprogress', 'enddate_future']) : ['past', 'ended_long_ago'],
      activePin: i === 3 ? false : i === 20 ? true : null,
    };
  });
}

export const PREVIEW_COURSES = baseUser().courses;
