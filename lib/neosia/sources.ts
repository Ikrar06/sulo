// Where NEOSIA data comes from (M7.1): each NEOSIA page the user opens and
// the API responses it triggers. Sulo never requests these itself; a "Buka"
// button only opens the page in a tab because the user clicked it. Pure.
//
// Mapping: final, from the owner's observation of 18 Nov 2026 (the dev list
// records the page each response came from).

import { NEOSIA_HOME, NEOSIA_KHS, NEOSIA_KRS, NEOSIA_MATAKULIAH, NEOSIA_TRANSKRIP } from '../links';
import type { EndpointId } from './allowlist';
import type { Snapshots } from './store';
import type { UnixSeconds } from '../types';

export type SourceId = 'beranda' | 'khs' | 'transkrip' | 'krs' | 'matakuliah';

export interface Source {
  id: SourceId;
  /** The NEOSIA page's own path. */
  page: string;
  url: string;
  /** Responses the page triggers (observation of 18 Nov 2026). */
  endpoints: readonly EndpointId[];
  /** Responses that must all be stored for the source to count as done. */
  requires: readonly EndpointId[];
  /** In "Lengkapi data dari NEOSIA": required (counted in "x dari 2"), optional, or not listed. */
  checklist: 'required' | 'optional' | null;
}

/**
 * Final mapping from the owner's observation of 18 Nov 2026. The KRS page
 * also triggers penasihat_akademik/getCurrentPenasihatAkademik, still
 * observed only (lib/neosia/allowlist.ts OBSERVE_ONLY).
 */
export const SOURCES: readonly Source[] = [
  { id: 'beranda', page: '/', url: NEOSIA_HOME, endpoints: ['dashboard', 'prodi_semester/active', 'belanja_krs', 'checkJadwalBelanjaKRS'], requires: ['dashboard', 'belanja_krs'], checklist: 'required' },
  { id: 'khs', page: '/kartu-hasil-studi', url: NEOSIA_KHS, endpoints: ['getTranskripMahasiswa', 'kartu_hasil_studi/semester', 'mahasiswa/semester'], requires: ['getTranskripMahasiswa', 'mahasiswa/semester'], checklist: 'required' },
  { id: 'transkrip', page: '/transkrip-nilai', url: NEOSIA_TRANSKRIP, endpoints: ['getTranskripMahasiswa', 'check_survey_status', 'indeks_prestasi/current'], requires: ['getTranskripMahasiswa'], checklist: null },
  { id: 'krs', page: '/kartu-rencana-studi', url: NEOSIA_KRS, endpoints: ['belanja_krs', 'max_sks', 'checkJadwalBelanjaKRS'], requires: ['max_sks'], checklist: 'optional' },
  { id: 'matakuliah', page: '/matakuliah', url: NEOSIA_MATAKULIAH, endpoints: ['kelas_kuliah_tersedia'], requires: ['kelas_kuliah_tersedia'], checklist: null },
];

export const CHECKLIST_SOURCES = SOURCES.filter((s) => s.checklist !== null);

export const sourceById = (id: SourceId): Source => SOURCES.find((s) => s.id === id)!;

export interface SourceStatus {
  source: Source;
  has: boolean;
  /** When the last of its required responses came in; null until all are there. */
  seenAt: UnixSeconds | null;
}

/** Stored with data; the semester list must carry its ids (capture version 2). */
function stored(snapshots: Snapshots, e: EndpointId): boolean {
  const snap = snapshots[e];
  if (!snap || snap.data === null) return false;
  if (e !== 'mahasiswa/semester') return true;
  const list = (snap.data as { semesters?: unknown }).semesters;
  return Array.isArray(list) && list.length > 0 && list.every((x) => x !== null && typeof x === 'object' && 'id' in x);
}

export function sourceStatuses(snapshots: Snapshots, sources: readonly Source[] = CHECKLIST_SOURCES): SourceStatus[] {
  return sources.map((source) => {
    const has = source.requires.every((e) => stored(snapshots, e));
    return { source, has, seenAt: has ? Math.max(...source.requires.map((e) => snapshots[e]!.seenAt)) : null };
  });
}

/** "1 dari 2": only required sources count; optional ones never hold the checklist open. */
export function completion(statuses: readonly SourceStatus[]): { done: number; total: number; complete: boolean } {
  const required = statuses.filter((s) => s.source.checklist === 'required');
  const done = required.filter((s) => s.has).length;
  return { done, total: required.length, complete: done === required.length };
}

/** Done or not for one source. */
export function sourceDone(snapshots: Snapshots, id: SourceId): boolean {
  return sourceStatuses(snapshots, [sourceById(id)])[0]!.has;
}

/**
 * The overview's NEOSIA card: the invite while the module is off (decided
 * elsewhere), the checklist while it is on and incomplete, "Data NEOSIA
 * lengkap" once when it became complete during this visit, else nothing.
 */
export function overviewNeosiaCard(input: { moduleOn: boolean; complete: boolean; sawIncomplete: boolean; doneShown: boolean }): 'checklist' | 'done' | null {
  if (!input.moduleOn) return null;
  if (!input.complete) return 'checklist';
  return input.sawIncomplete && !input.doneShown ? 'done' : null;
}

/** Endpoints whose snapshot is new or newer than before (for the "Data dari NEOSIA masuk" toast). */
export function arrivals(previous: Snapshots, next: Snapshots): EndpointId[] {
  return (Object.keys(next) as EndpointId[]).filter((e) => {
    const n = next[e]?.seenAt;
    const p = previous[e]?.seenAt;
    return typeof n === 'number' && (p === undefined || n > p);
  });
}

/** Older than `days` days. */
export function isOlderThan(seenAt: UnixSeconds | null, now: UnixSeconds, days = 30): boolean {
  return seenAt !== null && now - seenAt > days * 86_400;
}

/**
 * The KRS is from another semester than the academic calendar's current
 * one: different academic year, or Ganjil/awal against Genap/akhir. null
 * when either side is unknown.
 */
export function fromOtherSemester(krs: { tahunAjaran: string | null; jenis: string | null }, calendar: { tahunAjaran: string; semester: 'awal' | 'akhir' } | null): boolean | null {
  if (!calendar || !krs.tahunAjaran || !krs.jenis) return null;
  const j = krs.jenis.toLowerCase();
  const term = /ganjil|awal|odd/.test(j) ? 'awal' : /genap|akhir|even/.test(j) ? 'akhir' : null;
  if (term === null) return null;
  return krs.tahunAjaran.trim() !== calendar.tahunAjaran || term !== calendar.semester;
}

/** Which toast: grades on the Grades page, the schedule on the Schedule page, else the general one. */
export function arrivalMessage(endpoints: readonly EndpointId[], page: string): 'grades' | 'schedule' | 'any' | null {
  if (endpoints.length === 0) return null;
  if (page === 'nilai' && endpoints.includes('getTranskripMahasiswa')) return 'grades';
  if (page === 'jadwal' && endpoints.includes('belanja_krs')) return 'schedule';
  return 'any';
}
