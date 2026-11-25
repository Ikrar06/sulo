// The sample data every app screen on the landing page shows: the apps' own
// synthetic demo account (apps/extension/fixtures/guide, no person, student
// number or email) with the mockups' coursework titles (scripts/lib/mockup-data.mjs,
// the README hero's), at one fixed moment, so every build shows the same.
// Built once at build time; the browser never computes it again.
import { loadDashboardData, type DashboardData } from '@sulo/core/view/dashboard-data';
import { seedDemo } from '../../../mobile/src/fake/demo';
import { demoNeosia } from '../../../extension/scripts/lib/demo-neosia.mjs';
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

async function bangun(bahasa: Bahasa, neosia: boolean): Promise<DashboardData> {
  const store = memoryStore();
  await seedDemo(store, SEKARANG);
  if (neosia) for (const [kunci, nilai] of Object.entries(neosiaContoh())) await store.set(kunci, nilai);
  type Tugas = Parameters<typeof livelyTasks>[0][number];
  await store.set('u:1:tasks', livelyTasks((await store.get<Tugas[]>('u:1:tasks')) ?? [], SEKARANG));
  const prefs = (await store.get<Record<string, unknown>>('global:prefs')) ?? {};
  await store.set('global:prefs', { ...prefs, locale: bahasa, nickname: '', theme: 'system' });
  return loadDashboardData(store, jam as never, ZONA, true);
}

/**
 * The sample data in one language (the dates and words follow it). With
 * `neosia`, the optional NEOSIA module is connected too (the user guide's
 * Jadwal and Nilai); grades stay hidden, as in the apps until the student
 * chooses to show them.
 */
export function dataContoh(bahasa: Bahasa, neosia = false): Promise<DashboardData> {
  const kunci = `${bahasa}:${neosia}`;
  if (!siap.has(kunci)) siap.set(kunci, bangun(bahasa, neosia));
  return siap.get(kunci)!;
}
