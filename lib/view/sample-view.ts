// Example task list for onboarding ("Contoh tampilan"). Invented courses and
// tasks, built through the real buildPopupView so the example card always
// looks like the actual popup. Never mixed with the user's data.

import { DAILY_BUDGET } from '@/lib/moodle/limits';
import { DEFAULT_REMOTE_CONFIG } from '@/lib/remote/remote-config';
import { DEFAULT_SYNC_STATUS, DEFAULTS } from '@/lib/storage';
import type { CourseRecord, Task, UnixSeconds } from '@/lib/types';
import { id, type Messages } from '@/lib/i18n/id';
import { buildPopupView, type PopupView } from './popup-view';

const HOUR = 3600;
const DAY = 86_400;

const SAMPLE_COURSES: readonly [number, string][] = [
  [1, 'Fisika Dasar'],
  [2, 'Kalkulus II'],
  [3, 'Pendidikan Pancasila'],
  [4, 'Statistika'],
];

/** Task name, course id, due offset from now in seconds. */
const SAMPLE_TASKS: readonly [string, number, number][] = [
  ['Laporan praktikum gerak parabola', 1, -2 * HOUR],
  ['Kuis pekan 6', 2, 5 * HOUR],
  ['Esai refleksi nilai Pancasila', 3, 26 * HOUR],
  ['Tugas kelompok bab 4', 4, 3 * DAY],
];

function course(id: number, name: string, now: UnixSeconds): CourseRecord {
  return {
    id,
    fullname: name,
    shortname: name,
    startdate: now - 30 * DAY,
    enddate: now + 90 * DAY,
    parsed: { name, classLetter: null, program: null, code: null, matched: false },
    inProgress: true,
    past: false,
    activeScore: 8,
    activeReasons: ['inprogress'],
    activePin: null,
    alias: null,
    color: null,
  };
}

function task(i: number, [name, courseId, offset]: (typeof SAMPLE_TASKS)[number], now: UnixSeconds): Task {
  const dueAt = now + offset;
  return {
    eventId: -(i + 1),
    cmId: null,
    courseId,
    name,
    module: 'assign',
    dueAt,
    url: '#',
    overdue: dueAt < now,
    firstSeenAt: now - DAY,
    lastSeenAt: now,
    missingSince: null,
  };
}

export function buildSampleView(now: UnixSeconds, timeZone: string, messages: Messages = id): PopupView {
  return buildPopupView({
    user: {
      ...DEFAULTS,
      courses: SAMPLE_COURSES.map(([id, name]) => course(id, name, now)),
      tasks: SAMPLE_TASKS.map((t, i) => task(i, t, now)),
      sync: { lastSyncAt: now - 3 * 60, lastCourseListAt: now - HOUR },
      onboarding: { completedAt: now - DAY, confirmedInProgress: [], reviewSuggested: [] },
    },
    session: 'OK',
    syncStatus: DEFAULT_SYNC_STATUS,
    remoteConfig: DEFAULT_REMOTE_CONFIG,
    budget: { date: '', used: 0, bySource: {}, withCourseList: 0 },
    budgetLimit: DAILY_BUDGET,
    now,
    timeZone,
    messages,
  });
}
