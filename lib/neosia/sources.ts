// Where NEOSIA data comes from (M7.1): each NEOSIA page the user opens and
// the API responses it triggers. Sulo never requests these itself; a "Buka"
// button only opens the page in a tab because the user clicked it. Pure.
//
// Mapping: the owner's starting guess (18 Nov 2026), to be checked with the
// dev observation list, which now records the page each response came from.

import { NEOSIA_HOME, NEOSIA_KHS, NEOSIA_KRS, NEOSIA_MATAKULIAH, NEOSIA_TRANSKRIP } from '../links';
import type { EndpointId } from './allowlist';
import type { Snapshots } from './store';
import type { UnixSeconds } from '../types';

export type SourceId = 'beranda' | 'transkrip' | 'krs' | 'khs' | 'matakuliah';

export interface Source {
  id: SourceId;
  url: string;
  /** Responses the page triggers. */
  endpoints: readonly EndpointId[];
  /** The response that tells the source has data. */
  primary: EndpointId;
  /** Other responses the source must also have given to count as done. */
  alsoNeeds?: readonly EndpointId[];
  /** Shown in "Lengkapi data dari NEOSIA" (Mata kuliah is only for the future schedule planner). */
  checklist: boolean;
}

export const SOURCES: readonly Source[] = [
  { id: 'beranda', url: NEOSIA_HOME, endpoints: ['dashboard', 'prodi_semester/active', 'getStatusPembayaran'], primary: 'dashboard', checklist: true },
  { id: 'transkrip', url: NEOSIA_TRANSKRIP, endpoints: ['getTranskripMahasiswa', 'check_survey_status'], primary: 'getTranskripMahasiswa', checklist: true },
  { id: 'krs', url: NEOSIA_KRS, endpoints: ['belanja_krs', 'max_sks', 'checkJadwalBelanjaKRS'], primary: 'belanja_krs', checklist: true },
  // The semester list names the transcript's semesters; without it the Grades page could only say "Semester 3".
  { id: 'khs', url: NEOSIA_KHS, endpoints: ['kartu_hasil_studi/semester', 'mahasiswa/semester', 'indeks_prestasi/current'], primary: 'kartu_hasil_studi/semester', alsoNeeds: ['mahasiswa/semester'], checklist: true },
  { id: 'matakuliah', url: NEOSIA_MATAKULIAH, endpoints: ['kelas_kuliah_tersedia'], primary: 'kelas_kuliah_tersedia', checklist: false },
];

export const CHECKLIST_SOURCES = SOURCES.filter((s) => s.checklist);

export interface SourceStatus {
  source: Source;
  has: boolean;
  /** When the source's main response last came in; null without it. */
  seenAt: UnixSeconds | null;
}

export function sourceStatuses(snapshots: Snapshots, sources: readonly Source[] = CHECKLIST_SOURCES): SourceStatus[] {
  return sources.map((source) => {
    const main = snapshots[source.primary];
    const has = main !== undefined && main.data !== null && (source.alsoNeeds ?? []).every((e) => snapshots[e] !== undefined && snapshots[e]!.data !== null);
    return { source, has, seenAt: has ? main.seenAt : null };
  });
}

/** "2 dari 4": sources with data and the total. */
export function completion(statuses: readonly SourceStatus[]): { done: number; total: number; complete: boolean } {
  const done = statuses.filter((s) => s.has).length;
  return { done, total: statuses.length, complete: done === statuses.length };
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
