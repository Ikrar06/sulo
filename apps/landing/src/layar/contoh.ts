// The sample data every app screen on the landing page shows: the apps' own
// synthetic demo account (apps/extension/fixtures/guide, no person, student
// number or email) with the mockups' coursework titles (scripts/lib/mockup-data.mjs,
// the README hero's), at one fixed moment, so every build shows the same.
// Built once at build time; the browser never computes it again.
import { loadDashboardData, type DashboardData } from '@sulo/core/view/dashboard-data';
import { seedDemo } from '../../../mobile/src/fake/demo';
import { demoNeosia } from '../../../extension/scripts/lib/demo-neosia.mjs';
import { demoSipakamase } from '../../../extension/scripts/lib/demo-sipakamase.mjs';
import { setDone, type TaskStateMap } from '@sulo/core/tasks/local-state';
import type { TaskGrades } from '@sulo/core/tasks/grade-service';
import type { OwnTask } from '@sulo/core/tasks/own';
import type { Course, Task } from '@sulo/core/types';
import { livelyTasks } from '../../../../scripts/lib/mockup-data.mjs';
import { memoryStore } from './ganti/memory-store';
import type { Bahasa } from '../teks';

export const ZONA = 'Asia/Makassar';
/** Wednesday 25 November 2026, 07.30 WITA: a morning, like the hero's sky. */
export const SEKARANG = Date.UTC(2026, 10, 24, 23, 30) / 1000;
const jam = { now: () => SEKARANG, localDate: () => '2026-11-25', localHour: () => 7 };

const siap = new Map<string, Promise<DashboardData>>();

/** The synthetic NEOSIA snapshots (made-up lecturers, the demo courses' codes), as the module keeps them once connected. */
export const neosiaContoh = () =>
  // The demo's classes belong to an even semester; the sample day is in the odd one, so they are moved to it
  // (otherwise the schedule says, truthfully, that it is last semester's).
  JSON.parse(JSON.stringify(demoNeosia(SEKARANG)).replaceAll('"kode":"20262","jenis":"Genap"', '"kode":"20261","jenis":"Ganjil"')) as Record<string, unknown>;

async function bangun(bahasa: Bahasa, neosia: boolean, baru: boolean): Promise<DashboardData> {
  const store = memoryStore();
  await seedDemo(store, SEKARANG);
  if (neosia) for (const [kunci, nilai] of Object.entries(neosiaContoh())) await store.set(kunci, nilai);
  type Tugas = Parameters<typeof livelyTasks>[0][number];
  await store.set('u:1:tasks', livelyTasks((await store.get<Tugas[]>('u:1:tasks')) ?? [], SEKARANG));
  const prefs = (await store.get<Record<string, unknown>>('global:prefs')) ?? {};
  await store.set('global:prefs', { ...prefs, locale: bahasa, nickname: '', theme: 'system' });
  if (baru) await tambahBaru(store, bahasa, neosia);
  return loadDashboardData(store, jam as never, ZONA, true);
}

/** Made-up graded assignments of the sample courses, as a course's grades page would give them. */
const NILAI = ['88,00 (A)', '91,00 (A)', '84,00 (A-)'];

/**
 * 1.1.0's "Yang baru" page only (layar/dasbor.ts `baru`): three earlier assignments read from their courses'
 * grades pages, graded and so marked done (as Sulo does), one task the student added, and, with NEOSIA,
 * Sipakamase connected with its synthetic demo data. The home page's screens never get any of it.
 */
async function tambahBaru(store: ReturnType<typeof memoryStore>, bahasa: Bahasa, neosia: boolean): Promise<void> {
  const courses = (await store.get<Course[]>('u:1:courses')) ?? [];
  const tasks = (await store.get<Task[]>('u:1:tasks')) ?? [];
  const nama = bahasa === 'id' ? ['Tugas pekan 2', 'Laporan praktikum 1', 'Kuis esai pekan 3'] : ['Week 2 assignment', 'Lab report 1', 'Week 3 essay quiz'];
  const lama: Task[] = nama.map((name, i) => {
    const course = courses[i % Math.max(1, courses.length)]!;
    const cmId = 900_101 + i;
    return { eventId: -cmId, cmId: cmId as Task['cmId'], courseId: course.id, name, module: 'assign', dueAt: null, url: `https://sikola-v2.unhas.ac.id/mod/assign/view.php?id=${cmId}`, overdue: false, firstSeenAt: SEKARANG - 86_400, lastSeenAt: SEKARANG - 86_400, missingSince: SEKARANG - 86_400, fromReport: true };
  });
  await store.set('u:1:tasks', [...tasks, ...lama]);
  const grades: TaskGrades = Object.fromEntries(lama.map((t, i) => [String(t.cmId), { fetchedAt: SEKARANG - 3600, requestAt: SEKARANG - 3600, grade: { kind: 'graded', text: NILAI[i]!, got: Number.parseFloat(NILAI[i]!.replace(',', '.')), max: null, letter: /\(([^)]+)\)/.exec(NILAI[i]!)?.[1] ?? null } }]));
  await store.set('u:1:taskGrades', grades);
  let state = (await store.get<TaskStateMap>('u:1:taskState')) ?? {};
  for (const t of lama) state = setDone(state, t.eventId, true);
  await store.set('u:1:taskState', state);
  const sendiri: OwnTask = { id: -1, title: bahasa === 'id' ? 'Presentasi kelompok' : 'Group presentation', courseId: courses[1]?.id ?? courses[0]?.id ?? null, dueAt: SEKARANG + 5 * 3600, createdAt: SEKARANG - 86_400 };
  await store.set('u:1:ownTasks', [sendiri]);
  if (neosia) for (const [kunci, nilai] of Object.entries(demoSipakamase(SEKARANG))) await store.set(kunci, nilai);
}

/**
 * The sample data in one language (the dates and words follow it). With
 * `neosia`, the optional NEOSIA module is connected too (the user guide's
 * Jadwal and Nilai); grades stay hidden, as in the apps until the student
 * chooses to show them.
 */
export function dataContoh(bahasa: Bahasa, neosia = false, baru = false): Promise<DashboardData> {
  const kunci = `${bahasa}:${neosia}:${baru}`;
  if (!siap.has(kunci)) siap.set(kunci, bangun(bahasa, neosia, baru));
  return siap.get(kunci)!;
}
