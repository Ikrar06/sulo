// What the dashboard shows from NEOSIA snapshots (M7 part E). Pure: the
// snapshots are already projected and validated; this only reads them.
// Every value is optional: an endpoint not seen yet, or seen in a shape
// Sulo does not know, gives null, and the UI says "Belum ada data dari
// NEOSIA" instead of guessing.

import type { EndpointId } from './allowlist';
import type { Projected } from './project';
import type { NeosiaSnapshot, Snapshots } from './store';
import type { UnixSeconds } from '../types';

type Obj = { [key: string]: Projected };
const obj = (v: Projected | undefined): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);
const list = (v: Projected | undefined): Projected[] => (Array.isArray(v) ? v : []);
const str = (v: Projected | undefined): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : typeof v === 'number' ? String(v) : null);
const num = (v: Projected | undefined): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^-?\d+(?:[.,]\d+)?$/.test(v.trim())) return Number(v.trim().replace(',', '.'));
  return null;
};
const bool = (v: Projected | undefined): boolean | null => {
  if (typeof v === 'boolean') return v;
  if (v === 1 || v === '1' || v === 'true') return true;
  if (v === 0 || v === '0' || v === 'false') return false;
  return null;
};

/** Data of one endpoint, or null when not seen or never seen in a known shape. */
export function dataOf(snapshots: Snapshots, endpoint: EndpointId): Obj | Projected[] | null {
  const data = snapshots[endpoint]?.data;
  if (data === undefined || data === null) return null;
  return Array.isArray(data) ? data : obj(data);
}

/** "2027-01-03", "2027-01-03 08:00:00", "2027-01-03T08:00:00Z" → "2027-01-03". */
export function dateKeyOf(v: Projected | undefined): string | null {
  const s = str(v);
  const m = s ? /^(\d{4}-\d{2}-\d{2})/.exec(s) : null;
  return m ? m[1]! : null;
}

/** "07:30:00" or "7:30" → "07:30". */
export function hhmm(v: Projected | undefined): string | null {
  const s = str(v);
  const m = s ? /^(\d{1,2})[:.](\d{2})/.exec(s) : null;
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? `${String(h).padStart(2, '0')}:${m[2]}` : null;
}

/**
 * day_of_week to 0 (Sunday) … 6 (Saturday). Assumed 1 = Monday … 7 = Sunday,
 * 0 = Sunday: still to be verified against one known class (docs/NEOSIA.md).
 */
export function weekdayOf(v: Projected | undefined): number | null {
  const n = num(v);
  if (n === null || !Number.isInteger(n) || n < 0 || n > 7) return null;
  return n === 7 ? 0 : n;
}

// ---------- KRS window ----------

export interface KrsWindow {
  start: string;
  end: string;
  source: 'neosia' | 'calendar';
}

/**
 * The KRS window from checkJadwalBelanjaKRS: the one open today, else the
 * next one, else the last. Entries whose type names KRS win over others.
 */
export function krsWindowFromNeosia(snapshots: Snapshots, today: string): KrsWindow | null {
  const data = obj(dataOf(snapshots, 'checkJadwalBelanjaKRS') as Projected);
  const windows = list(data?.prodiSemesterJadwalKrses)
    .map((w) => obj(w))
    .filter((w): w is Obj => w !== null)
    .map((w) => {
      const type = obj(w.semester_tipe_jadwal);
      const label = `${str(type?.name) ?? ''} ${str(type?.caption) ?? ''}`;
      return { start: dateKeyOf(w.tanggal_mulai), end: dateKeyOf(w.tanggal_berakhir), krs: /krs|rencana studi/i.test(label) };
    })
    .filter((w): w is { start: string; end: string; krs: boolean } => w.start !== null && w.end !== null && w.end >= w.start);
  const pool = windows.some((w) => w.krs) ? windows.filter((w) => w.krs) : windows;
  const sorted = [...pool].sort((a, b) => a.start.localeCompare(b.start));
  const pick = sorted.find((w) => w.start <= today && today <= w.end) ?? sorted.find((w) => w.start > today) ?? sorted.at(-1);
  return pick ? { start: pick.start, end: pick.end, source: 'neosia' } : null;
}

/** NEOSIA's own window wins; the academic calendar's KRS dates are the fallback. */
export function krsWindow(snapshots: Snapshots, today: string, calendarKrs: readonly { mulai: string; selesai: string | null }[]): KrsWindow | null {
  const fromNeosia = krsWindowFromNeosia(snapshots, today);
  if (fromNeosia) return fromNeosia;
  const sorted = calendarKrs.map((k) => ({ start: k.mulai, end: k.selesai ?? k.mulai })).sort((a, b) => a.start.localeCompare(b.start));
  const pick = sorted.find((w) => w.start <= today && today <= w.end) ?? sorted.find((w) => w.start > today);
  return pick ? { ...pick, source: 'calendar' } : null;
}

/** Days before the window opens that the readiness card appears. */
export const KRS_CARD_LEAD_DAYS = 14;

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** The overview card shows from 14 days before the window until its last day. */
export function showKrsCard(window: KrsWindow | null, today: string): boolean {
  if (!window) return false;
  return today <= window.end && daysBetween(today, window.start) <= KRS_CARD_LEAD_DAYS;
}

// ---------- KRS readiness ----------

export type ItemState = 'ok' | 'action' | 'info' | 'unknown';

export type ReadinessItem =
  | { id: 'window'; state: ItemState; window: KrsWindow | null; phase: 'before' | 'open' | 'closed' | null }
  | { id: 'payment'; state: ItemState; paid: boolean | null }
  | { id: 'pa'; state: ItemState; name: string | null }
  | { id: 'survey'; state: ItemState; filled: boolean | null }
  | { id: 'sks'; state: ItemState; max: number | null; available: number | null }
  | { id: 'krs'; state: ItemState; status: 'locked' | 'approved' | 'submitted' | 'empty' | null };

export function paymentPaid(snapshots: Snapshots): boolean | null {
  const data = obj(dataOf(snapshots, 'getStatusPembayaran') as Projected);
  if (!data) return null;
  const flag = bool(data.is_lunas) ?? bool(data.lunas);
  if (flag !== null) return flag;
  const label = `${str(data.status) ?? ''} ${str(data.status_pembayaran) ?? ''}`.toLowerCase();
  if (/belum|unpaid|not paid/.test(label)) return false;
  if (/lunas|paid|sudah/.test(label)) return true;
  return null;
}

/** The advisor's name with titles ("Dr. Nama, S.T., M.T."), or null. */
export function advisorName(snapshots: Snapshots): string | null {
  const data = obj(dataOf(snapshots, 'getCurrentPenasihatAkademik') as Projected);
  const person = obj(data?.dosen) ?? data;
  const name = str(person?.nama);
  if (!name) return null;
  const front = str(person?.gelar_depan);
  const back = str(person?.gelar_belakang);
  return `${front ? `${front} ` : ''}${name}${back ? `, ${back}` : ''}`;
}

export function surveyFilled(snapshots: Snapshots): boolean | null {
  return bool(obj(dataOf(snapshots, 'check_survey_status') as Projected)?.is_filled);
}

export function sksQuota(snapshots: Snapshots): { max: number | null; available: number | null } | null {
  const data = obj(dataOf(snapshots, 'max_sks') as Projected);
  if (!data) return null;
  return { max: num(data.max_sks), available: num(obj(data.current_sks)?.available) };
}

export function krsStatus(snapshots: Snapshots): 'locked' | 'approved' | 'submitted' | 'empty' | null {
  const krs = obj(obj(dataOf(snapshots, 'belanja_krs') as Projected)?.kartu_rencana_studi);
  if (!krs) return null;
  if (bool(krs.is_locked)) return 'locked';
  if (bool(krs.is_approved)) return 'approved';
  return list(krs.kelas_kuliahs).length > 0 ? 'submitted' : 'empty';
}

export function readiness(snapshots: Snapshots, window: KrsWindow | null, today: string): ReadinessItem[] {
  const phase = window === null ? null : today < window.start ? 'before' : today <= window.end ? 'open' : 'closed';
  const paid = paymentPaid(snapshots);
  const pa = advisorName(snapshots);
  const filled = surveyFilled(snapshots);
  const quota = sksQuota(snapshots);
  const status = krsStatus(snapshots);
  return [
    { id: 'window', state: window === null ? 'unknown' : 'info', window, phase },
    { id: 'payment', state: paid === null ? 'unknown' : paid ? 'ok' : 'action', paid },
    { id: 'pa', state: pa === null ? 'unknown' : 'ok', name: pa },
    { id: 'survey', state: filled === null ? 'unknown' : filled ? 'ok' : 'action', filled },
    { id: 'sks', state: quota === null || quota.max === null ? 'unknown' : 'info', max: quota?.max ?? null, available: quota?.available ?? null },
    { id: 'krs', state: status === null ? 'unknown' : status === 'empty' ? (phase === 'open' ? 'action' : 'info') : status === 'submitted' ? 'info' : 'ok', status },
  ];
}

// ---------- Schedule ----------

export interface ClassMeeting {
  /** Course code from NEOSIA (11 characters, the same pattern as SIKOLA's). */
  code: string | null;
  name: string;
  className: string | null;
  sks: number | null;
  /** 0 Sunday … 6 Saturday. */
  weekday: number;
  start: string;
  end: string;
  room: string | null;
  lecturers: string[];
}

function lecturerName(v: Projected): string | null {
  const d = obj(v);
  const name = str(d?.nama);
  if (!name) return null;
  const front = str(d?.gelar_depan);
  const back = str(d?.gelar_belakang);
  return `${front ? `${front} ` : ''}${name}${back ? `, ${back}` : ''}`;
}

/** Weekly meetings from the KRS, sorted by day and start time. */
export function classMeetings(snapshots: Snapshots): ClassMeeting[] {
  const krs = obj(obj(dataOf(snapshots, 'belanja_krs') as Projected)?.kartu_rencana_studi);
  const out: ClassMeeting[] = [];
  for (const k of list(krs?.kelas_kuliahs)) {
    const kelas = obj(k);
    if (!kelas) continue;
    const mk = obj(kelas.mata_kuliah);
    const name = str(mk?.nama) ?? str(kelas.nama);
    if (!name) continue;
    for (const j of list(kelas.jadwal_kuliahs)) {
      const slot = obj(j);
      const weekday = weekdayOf(slot?.day_of_week);
      const start = hhmm(slot?.start_time);
      const end = hhmm(slot?.end_time);
      if (weekday === null || start === null || end === null || end <= start) continue;
      const ruang = slot?.ruang;
      out.push({
        code: str(mk?.kode) ?? str(kelas.kode),
        name,
        className: str(kelas.nama_kelas),
        sks: num(mk?.sks) ?? num(kelas.sks),
        weekday,
        start,
        end,
        room: typeof ruang === 'string' ? ruang : (str(obj(ruang ?? null)?.nama) ?? str(obj(ruang ?? null)?.kode)),
        lecturers: list(kelas.dosens).map(lecturerName).filter((n): n is string => n !== null),
      });
    }
  }
  return out.sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
}

/** Semester label of the KRS ("2026/2027", "akhir"), for the ICS uid. */
export function krsSemester(snapshots: Snapshots): { tahunAjaran: string | null; jenis: string | null; kode: string | null } {
  const data = obj(dataOf(snapshots, 'belanja_krs') as Projected);
  const sem = obj(obj(data?.kartu_rencana_studi)?.semester) ?? obj(data?.semester) ?? obj(obj(dataOf(snapshots, 'prodi_semester/active') as Projected)?.semester);
  return { tahunAjaran: str(sem?.tahun_ajaran), jenis: str(sem?.jenis), kode: str(sem?.kode) };
}

// ---------- Profile ----------

/** A common S1 total, only as the bar's scale; Sulo never says how many credits are left to graduate. */
export const SKS_BAR_SCALE = 144;

export interface Profile {
  semester: number | null;
  sksPassed: number | null;
  ipk: number | null;
  ips: number | null;
  masaStudi: { maksimal: number | null; sisa: number | null } | null;
}

export function profile(snapshots: Snapshots): Profile | null {
  const dash = obj(dataOf(snapshots, 'dashboard') as Projected);
  const maxSks = obj(dataOf(snapshots, 'max_sks') as Projected);
  const transcript = obj(dataOf(snapshots, 'getTranskripMahasiswa') as Projected);
  const current = obj(dataOf(snapshots, 'indeks_prestasi/current') as Projected);
  const ip = obj(dash?.indeks_prestasi);
  const study = obj(dash?.masa_studi);
  const maksimal = num(study?.maksimal);
  const sisa = num(study?.sisa);
  const fromContext = num(obj(maxSks?.context)?.current_semester);
  // Fallback still to be verified for students who took leave (docs/NEOSIA.md).
  const semester = fromContext ?? (maksimal !== null && sisa !== null ? maksimal - sisa + 1 : null);
  const out: Profile = {
    semester: semester !== null && semester > 0 && semester < 30 ? semester : null,
    sksPassed: num(ip?.jumlah_sks_dilulusi) ?? num(obj(transcript?.current_indeks_prestasi)?.jumlah_sks),
    ipk: num(ip?.ipk) ?? num(obj(transcript?.current_indeks_prestasi)?.ipk) ?? num(current?.ipk),
    ips: num(current?.ips) ?? num(obj(transcript?.current_indeks_prestasi)?.ips),
    masaStudi: study ? { maksimal, sisa } : null,
  };
  return Object.values(out).every((v) => v === null) ? null : out;
}

// ---------- Transcript and new grades ----------

export interface GradeRow {
  key: string;
  code: string | null;
  name: string;
  semester: string | null;
  /** Letter grade; shown only behind "Tampilkan", never in notifications. */
  letter: string | null;
}

export function transcriptRows(data: Projected | null | undefined): GradeRow[] {
  const rows = list(obj(data ?? null)?.transkrip);
  return rows
    .map((r) => obj(r))
    .filter((r): r is Obj => r !== null)
    .map((r) => {
      const mk = obj(r.mata_kuliah);
      const code = str(r.kode) ?? str(mk?.kode);
      const name = str(r.nama) ?? str(mk?.nama) ?? code ?? '';
      const semester = str(r.id_semester);
      return { key: `${code ?? name}|${semester ?? ''}`, code, name, semester, letter: str(r.nilai_huruf) };
    })
    .filter((r) => r.name !== '');
}

/**
 * New grades between two transcript snapshots (key: code + semester): a row
 * that is new with a letter, or whose letter appeared. A changed letter is
 * not "new" (it would hint at the grade itself).
 */
export function newGrades(previous: Projected | null, next: Projected | null): GradeRow[] {
  const before = new Map(transcriptRows(previous).map((r) => [r.key, r]));
  return transcriptRows(next).filter((r) => r.letter !== null && (before.get(r.key)?.letter ?? null) === null);
}

// ---------- Status ----------

export interface NeosiaStatus {
  lastSeenAt: UnixSeconds | null;
  /** Endpoints whose latest answer had an unknown shape. */
  changedShape: EndpointId[];
}

export function neosiaStatus(snapshots: Snapshots): NeosiaStatus {
  const all = Object.values(snapshots) as NeosiaSnapshot[];
  return {
    lastSeenAt: all.length ? Math.max(...all.map((s) => s.seenAt)) : null,
    changedShape: all.filter((s) => s.unknownShapeAt !== null).map((s) => s.endpoint),
  };
}
