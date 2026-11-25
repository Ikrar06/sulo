// The sample data every app screen on the landing page shows: the apps' own
// synthetic demo account (apps/extension/fixtures/guide, no person, student
// number or email) with the mockups' coursework titles (scripts/lib/mockup-data.mjs,
// the README hero's), at one fixed moment, so every build shows the same.
// Built once at build time; the browser never computes it again.
import { loadDashboardData, type DashboardData } from '@sulo/core/view/dashboard-data';
import { seedDemo } from '../../../mobile/src/fake/demo';
import { livelyTasks } from '../../../../scripts/lib/mockup-data.mjs';
import { memoryStore } from './ganti/memory-store';
import type { Bahasa } from '../teks';

export const ZONA = 'Asia/Makassar';
/** Wednesday 25 November 2026, 07.30 WITA: a morning, like the hero's sky. */
export const SEKARANG = Date.UTC(2026, 10, 24, 23, 30) / 1000;
const jam = { now: () => SEKARANG, localDate: () => '2026-11-25', localHour: () => 7 };

const siap = new Map<Bahasa, Promise<DashboardData>>();

async function bangun(bahasa: Bahasa): Promise<DashboardData> {
  const store = memoryStore();
  await seedDemo(store, SEKARANG);
  type Tugas = Parameters<typeof livelyTasks>[0][number];
  await store.set('u:1:tasks', livelyTasks((await store.get<Tugas[]>('u:1:tasks')) ?? [], SEKARANG));
  const prefs = (await store.get<Record<string, unknown>>('global:prefs')) ?? {};
  await store.set('global:prefs', { ...prefs, locale: bahasa, nickname: '', theme: 'system' });
  return loadDashboardData(store, jam as never, ZONA, true);
}

/** The sample data in one language (the dates and words follow it). */
export function dataContoh(bahasa: Bahasa): Promise<DashboardData> {
  if (!siap.has(bahasa)) siap.set(bahasa, bangun(bahasa));
  return siap.get(bahasa)!;
}
