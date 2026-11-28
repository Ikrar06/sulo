// The screens the user guide shows, by name.
//
// Dashboard (/layar/<bahasa>/dasbor/<name>/auto/): which page of the extension's
// dashboard, a detail to open on it (a task, a course, a settings section),
// whether the sample data has the optional NEOSIA module connected, and
// whether the page comes alive in the browser ("hidup"). A page is drawn at
// build time and stays a picture; only the ones with drop-downs or an opened
// detail are hydrated, because those show nothing until the page's own code
// has run.
//
// Phone (/layar/<bahasa>/hp/<name>/auto/): the same for the Android app.
import type { DashboardData } from '@sulo/core/view/dashboard-data';
import type { ScreenName } from '../../../mobile/src/shell/nav';
import type { HalamanDasbor } from './LayarLaptop';

/** A detail picked from the sample data: the nearest task still to do, the first graded one, or the first course with recorded attendance. */
type Rincian = 'tugas' | 'nilai' | 'presensi' | string;

interface Dasbor {
  halaman: HalamanDasbor;
  rincian?: Rincian;
  neosia?: boolean;
  hidup?: boolean;
  /** The element (by id) the page is scrolled to, for a part further down. */
  ke?: string;
  /** The window's height in points, for a page shorter than a laptop screen (800): no empty band under it. */
  tinggi?: number;
  /** The "Yang baru" page's sample data (contoh.ts tambahBaru): graded tasks, an own task, Sipakamase. */
  baru?: boolean;
}

/** A dashboard screen's size in points. */
export const LEBAR_DASBOR = 1280;
export const TINGGI_DASBOR = 800;

export const LAYAR_DASBOR = {
  ringkasan: { halaman: 'ringkasan' },
  tugas: { halaman: 'tugas', hidup: true },
  'tugas-rincian': { halaman: 'tugas', rincian: 'tugas', hidup: true },
  'mata-kuliah': { halaman: 'mata-kuliah', tinggi: 600 },
  presensi: { halaman: 'presensi', tinggi: 600 },
  'presensi-rincian': { halaman: 'presensi', rincian: 'presensi', tinggi: 710 },
  kabar: { halaman: 'kabar', hidup: true, tinggi: 620 },
  kalender: { halaman: 'kalender' },
  pengaturan: { halaman: 'pengaturan', hidup: true },
  'pengaturan-pengingat': { halaman: 'pengaturan', hidup: true, ke: 'set-pengingat' },
  // Short, so the page can scroll far enough to put Data at the top (it is near the page's end).
  'pengaturan-data': { halaman: 'pengaturan', hidup: true, ke: 'set-data', tinggi: 520 },
  'neosia-ringkasan': { halaman: 'ringkasan', neosia: true },
  'neosia-jadwal': { halaman: 'jadwal', neosia: true },
  'neosia-nilai': { halaman: 'nilai', neosia: true },
  'neosia-pengaturan': { halaman: 'pengaturan', neosia: true, hidup: true, ke: 'set-neosia' },
  // "Yang baru di Sulo" (1.1.0).
  'baru-nilai': { halaman: 'tugas', rincian: 'nilai', hidup: true, baru: true },
  'baru-sipakamase': { halaman: 'ringkasan', neosia: true, baru: true, ke: 'mkpk' },
  'baru-sendiri': { halaman: 'tugas', hidup: true, baru: true, tinggi: 560 },
} as const satisfies Record<string, Dasbor>;
export type LayarDasbor = keyof typeof LAYAR_DASBOR;
export const dasbor = (nama: LayarDasbor): Dasbor => LAYAR_DASBOR[nama];

interface Hp {
  layar: ScreenName;
  rincian?: Rincian;
  neosia?: boolean;
  baru?: boolean;
}

export const LAYAR_HP = {
  ringkasan: { layar: 'ringkasan' },
  presensi: { layar: 'presensi' },
  'presensi-rincian': { layar: 'presensi', rincian: 'presensi' },
  kabar: { layar: 'kabar' },
  tugas: { layar: 'tugas' },
  'tugas-rincian': { layar: 'tugas', rincian: 'tugas' },
  kalender: { layar: 'kalender' },
  lainnya: { layar: 'lainnya' },
  'mata-kuliah': { layar: 'mata-kuliah' },
  pengaturan: { layar: 'pengaturan' },
  'neosia-ringkasan': { layar: 'ringkasan', neosia: true },
  'neosia-lainnya': { layar: 'lainnya', neosia: true },
  'neosia-jadwal': { layar: 'jadwal', neosia: true },
  'neosia-nilai': { layar: 'nilai', neosia: true },
  'baru-tugas': { layar: 'tugas', baru: true },
} as const satisfies Record<string, Hp>;
export type LayarHpNama = keyof typeof LAYAR_HP;
export const hp = (nama: LayarHpNama): Hp => LAYAR_HP[nama];

/** The detail's id in the sample data ("tugas": the nearest task still to do; "presensi": the first followed course with sessions). */
export function rincianDari(data: DashboardData, rincian: Rincian | undefined): string | null {
  if (!rincian) return null;
  if (rincian === 'tugas') {
    const tugas = (data.user?.tasks ?? []).filter((t) => t.dueAt !== null && t.dueAt > data.now).sort((a, b) => a.dueAt! - b.dueAt!)[0];
    return tugas ? String(tugas.eventId) : null;
  }
  if (rincian === 'nilai') {
    const answers = data.user?.taskGrades ?? {};
    const graded = (data.user?.tasks ?? []).find((t) => t.cmId !== null && answers[String(t.cmId)]?.grade?.kind === 'graded');
    return graded ? String(graded.eventId) : null;
  }
  if (rincian === 'presensi') {
    const baris = data.user?.presensi?.recap?.rows ?? [];
    const pertama = baris.find((r) => (r.taken ?? 0) > 0) ?? baris[0];
    return pertama ? String(pertama.courseId) : null;
  }
  return rincian;
}
