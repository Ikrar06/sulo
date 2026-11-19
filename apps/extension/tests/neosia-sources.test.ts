import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR_NOTIFY } from '@sulo/core/calendar/notify-settings';
import { NEOSIA_HOME, NEOSIA_KHS, NEOSIA_KRS, NEOSIA_MATAKULIAH, NEOSIA_TRANSKRIP } from '@sulo/core/links';
import { CAPTURE_SCHEMA_VERSION, ENDPOINTS, OBSERVE_ONLY, type EndpointId } from '@sulo/core/neosia/allowlist';
import { showInvite } from '@sulo/core/neosia/invite';
import { matchUrl } from '@sulo/core/neosia/match';
import { projectResponse } from '@sulo/core/neosia/project';
import type { ReadinessItem } from '@sulo/core/neosia/view';
import { readinessLink } from '@sulo/ui/dashboard/NeosiaParts';
import { SECRET, SYNTHETIC } from './neosia-synthetic';
import { connectFlow } from '@sulo/core/neosia/connect-flow';
import { neosiaNudges, nudgeTarget } from '@sulo/core/neosia/nudges';
import { arrivalMessage, arrivals, CHECKLIST_SOURCES, completion, fromOtherSemester, isOlderThan, overviewNeosiaCard, SOURCES, sourceDone, sourceStatuses } from '@sulo/core/neosia/sources';
import { pruneUnlistedSnapshots, type NeosiaSnapshot, type Snapshots } from '@sulo/core/neosia/store';
import { planReminders } from '@sulo/core/reminders/plan';
import { DEFAULT_REMINDERS } from '@sulo/core/reminders/settings';
import { zonedToUnix } from '@sulo/core/reminders/zoned';
import type { Kegiatan } from '@sulo/core/calendar/schema';

const snap = (endpoint: EndpointId, seenAt = 100): NeosiaSnapshot => ({ endpoint, v: CAPTURE_SCHEMA_VERSION, data: {}, changedAt: seenAt, seenAt, unknownShapeAt: null });

describe('Hubungkan: the NEOSIA tab', () => {
  const run = (granted: boolean | 'throw', enable: 'enabled' | 'failed' = 'enabled') => {
    const opened: string[] = [];
    const outcome = connectFlow({
      requestPermission: async () => {
        if (granted === 'throw') throw new Error('x');
        return granted;
      },
      enable: async () => enable,
      openTab: async (url) => void opened.push(url),
    });
    return outcome.then((o) => ({ o, opened }));
  };
  it('opens the NEOSIA home page only after the permission is given and the module is on', async () => {
    expect(await run(true)).toEqual({ o: 'connected', opened: [NEOSIA_HOME] });
  });
  it('opens nothing when the permission is refused or the module fails', async () => {
    expect(await run(false)).toEqual({ o: 'denied', opened: [] });
    expect(await run('throw')).toEqual({ o: 'failed', opened: [] });
    expect(await run(true, 'failed')).toEqual({ o: 'failed', opened: [] });
  });
});

describe('page mapping (observation of 18 Nov 2026)', () => {
  it('maps each NEOSIA page to the responses it triggers', () => {
    expect(SOURCES.map((s) => [s.id, s.page, s.url, s.endpoints])).toEqual([
      ['beranda', '/', NEOSIA_HOME, ['dashboard', 'prodi_semester/active', 'belanja_krs', 'checkJadwalBelanjaKRS']],
      ['khs', '/kartu-hasil-studi', NEOSIA_KHS, ['getTranskripMahasiswa', 'kartu_hasil_studi/semester', 'mahasiswa/semester', 'check_survey_status']],
      ['transkrip', '/transkrip-nilai', NEOSIA_TRANSKRIP, ['getTranskripMahasiswa', 'check_survey_status', 'indeks_prestasi/current']],
      ['krs', '/kartu-rencana-studi', NEOSIA_KRS, ['belanja_krs', 'max_sks', 'checkJadwalBelanjaKRS', 'getCurrentPenasihatAkademik']],
      ['matakuliah', '/matakuliah', NEOSIA_MATAKULIAH, ['kelas_kuliah_tersedia']],
    ]);
  });
  it('every mapped response is on the allowlist; the payment status endpoint is gone', () => {
    const listed = new Set(ENDPOINTS.map((e) => e.id as string));
    for (const s of SOURCES) for (const e of s.endpoints) expect(listed.has(e)).toBe(true);
    expect(listed.has('getStatusPembayaran')).toBe(false);
  });
  it('transcript renew and the notice board stay unread', () => {
    const api = 'https://api.neosia.unhas.ac.id/api';
    expect(matchUrl(`${api}/mahasiswa/transkrip/renew`)?.kind).toBe('other');
    expect(matchUrl(`${api}/notice_board`)?.kind).toBe('other');
    expect(matchUrl(`${api}/mahasiswa/penasihat_akademik/getCurrentPenasihatAkademik`)?.kind).toBe('endpoint');
  });
  it('getStatusPembayaran (triggered by the KRS page) stays unread', () => {
    const api = 'https://api.neosia.unhas.ac.id/api';
    expect(matchUrl(`${api}/mahasiswa/pembayaran/getStatusPembayaran`)?.kind).toBe('other');
    expect(SOURCES.flatMap((s) => s.endpoints as readonly string[])).not.toContain('getStatusPembayaran');
  });
  it('no checklist item needs indeks_prestasi/current', () => {
    expect(CHECKLIST_SOURCES.flatMap((s) => s.requires)).not.toContain('indeks_prestasi/current');
    expect(ENDPOINTS.some((e) => e.id === 'indeks_prestasi/current')).toBe(true);
  });
  it('the advisor endpoint is captured (name only); nothing is left observe-only', () => {
    expect(OBSERVE_ONLY).toEqual([]);
    expect(ENDPOINTS.find((e) => e.path.includes('penasihat_akademik'))?.spec).toEqual({ currentPenasihatAkademik: { dosen: { nama: 'v' } } });
  });
});

describe('"Lengkapi data dari NEOSIA": completion', () => {
  const semesterList = (withId: boolean): NeosiaSnapshot => ({ ...snap('mahasiswa/semester'), data: { semesters: [withId ? { id: 20251, nama: 'Ganjil' } : { nama: 'Ganjil' }] } });
  it('lists Beranda and KHS (required) and KRS (optional), not the transcript or course list', () => {
    expect(CHECKLIST_SOURCES.map((s) => [s.id, s.checklist])).toEqual([
      ['beranda', 'required'],
      ['khs', 'required'],
      ['krs', 'optional'],
    ]);
  });
  it('Beranda needs dashboard and belanja_krs', () => {
    expect(sourceDone({ dashboard: snap('dashboard') }, 'beranda')).toBe(false);
    expect(sourceDone({ dashboard: snap('dashboard', 50), belanja_krs: snap('belanja_krs', 80) }, 'beranda')).toBe(true);
    expect(sourceStatuses({ dashboard: snap('dashboard', 50), belanja_krs: snap('belanja_krs', 80) })[0]!.seenAt).toBe(80);
  });
  it('KHS needs the transcript and the semester list with ids (capture version 2)', () => {
    const t = { getTranskripMahasiswa: snap('getTranskripMahasiswa') };
    expect(sourceDone(t, 'khs')).toBe(false);
    expect(sourceDone({ ...t, 'mahasiswa/semester': semesterList(false) }, 'khs')).toBe(false);
    expect(sourceDone({ ...t, 'mahasiswa/semester': semesterList(true) }, 'khs')).toBe(true);
    expect(sourceDone({ ...t, 'mahasiswa/semester': { ...semesterList(true), data: null } }, 'khs')).toBe(false);
  });
  it('KRS needs max_sks', () => {
    expect(sourceDone({ belanja_krs: snap('belanja_krs') }, 'krs')).toBe(false);
    expect(sourceDone({ max_sks: snap('max_sks') }, 'krs')).toBe(true);
  });
  it('"x dari 2" counts required pages only; the optional one never holds it open', () => {
    expect(completion(sourceStatuses({}))).toEqual({ done: 0, total: 2, complete: false });
    expect(completion(sourceStatuses({ max_sks: snap('max_sks') }))).toEqual({ done: 0, total: 2, complete: false });
    const beranda: Snapshots = { dashboard: snap('dashboard'), belanja_krs: snap('belanja_krs') };
    expect(completion(sourceStatuses(beranda))).toEqual({ done: 1, total: 2, complete: false });
    const both: Snapshots = { ...beranda, getTranskripMahasiswa: snap('getTranskripMahasiswa'), 'mahasiswa/semester': semesterList(true) };
    expect(completion(sourceStatuses(both))).toEqual({ done: 2, total: 2, complete: true });
  });
});

describe('overview: the NEOSIA card', () => {
  const card = (moduleOn: boolean, complete: boolean, sawIncomplete = false, doneShown = false) => overviewNeosiaCard({ moduleOn, complete, sawIncomplete, doneShown });
  it('module off: never the checklist (the invite takes that place)', () => {
    expect(card(false, false)).toBeNull();
    expect(card(false, true, true)).toBeNull();
  });
  it('module on and incomplete: the checklist', () => {
    expect(card(true, false)).toBe('checklist');
  });
  it('completed during this visit: "Data NEOSIA lengkap" once, then gone', () => {
    expect(card(true, true, true, false)).toBe('done');
    expect(card(true, true, true, true)).toBeNull();
  });
  it('already complete when the page opens: nothing', () => {
    expect(card(true, true, false)).toBeNull();
  });
  it('the invite shows only while the module is off, so the two never meet', () => {
    const base = { dismissedAt: null, dismissedDay: null, now: 1_800_000_000, today: '2027-01-05', krsWindows: [] };
    expect(showInvite({ ...base, moduleOn: true })).toBe(false);
    for (const complete of [true, false]) expect(showInvite({ ...base, moduleOn: true }) && card(true, complete) !== null).toBe(false);
  });
});

describe('button targets', () => {
  it('nudges: grades open the KHS, KRS opens the KRS page', () => {
    expect(nudgeTarget('nudge:grades:input-nilai')).toBe(NEOSIA_KHS);
    expect(nudgeTarget('nudge:krs:krs-akhir')).toBe(NEOSIA_KRS);
  });
  it('Kesiapan KRS: survey unchecked links the KHS only in the KRS window; missing credits link KRS', () => {
    const survey: ReadinessItem = { id: 'survey', state: 'unknown', filled: null };
    expect(readinessLink(survey, true)).toEqual({ href: NEOSIA_KHS, label: 'surveyCheck' });
    expect(readinessLink(survey, false)).toBeNull();
    expect(readinessLink({ id: 'sks', state: 'unknown', max: null, available: null } as ReadinessItem, false)).toEqual({ href: NEOSIA_KRS, label: 'open' });
    expect(readinessLink({ id: 'payment', state: 'action', paid: false } as ReadinessItem, true)).toEqual({ href: NEOSIA_KRS, label: 'open' });
    expect(readinessLink({ id: 'payment', state: 'ok', paid: true } as ReadinessItem, true)).toBeNull();
  });
});

describe('storage: no payment data besides sudah_bayar', () => {
  it('the dashboard projection keeps pembayaran.sudah_bayar only', () => {
    const dashboard = ENDPOINTS.find((e) => e.id === 'dashboard')!;
    const result = projectResponse(dashboard.spec, SYNTHETIC.dashboard);
    expect(result.status).toBe('ok');
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.pembayaran).toEqual({ sudah_bayar: true });
    const text = JSON.stringify(data);
    expect(text).not.toContain(String(SECRET.nominal));
    expect(text).not.toContain(SECRET.bank);
  });
  it('no endpoint spec mentions an amount or a bank', () => {
    const text = JSON.stringify(ENDPOINTS.map((e) => e.spec));
    expect(text).not.toMatch(/nominal|bank|tagihan|jumlah_bayar/);
  });
  it('old payment snapshots are deleted', async () => {
    const data = new Map<string, unknown>([
      ['neosia:snap:getStatusPembayaran', { x: 1 }],
      ['neosia:snap:dashboard', { x: 1 }],
    ]);
    const store = {
      keys: async (prefix: string) => [...data.keys()].filter((k) => k.startsWith(prefix)),
      remove: async (keys: string[]) => void keys.forEach((k) => data.delete(k)),
    };
    expect(await pruneUnlistedSnapshots(store as never)).toEqual(['neosia:snap:getStatusPembayaran']);
    expect([...data.keys()]).toEqual(['neosia:snap:dashboard']);
  });
});

describe('toast when NEOSIA data comes in', () => {
  it('names new or newer snapshots only', () => {
    expect(arrivals({ dashboard: snap('dashboard', 100) }, { dashboard: snap('dashboard', 100) })).toEqual([]);
    expect(arrivals({ dashboard: snap('dashboard', 100) }, { dashboard: snap('dashboard', 200), getTranskripMahasiswa: snap('getTranskripMahasiswa') })).toEqual(['dashboard', 'getTranskripMahasiswa']);
  });
  it('says grades on the Grades page, the schedule on the Schedule page, else the general line', () => {
    expect(arrivalMessage(['getTranskripMahasiswa'], 'nilai')).toBe('grades');
    expect(arrivalMessage(['belanja_krs'], 'jadwal')).toBe('schedule');
    expect(arrivalMessage(['dashboard'], 'nilai')).toBe('any');
    expect(arrivalMessage([], 'nilai')).toBeNull();
  });
});

describe('old data', () => {
  const DAY = 86_400;
  it('a transcript older than 30 days', () => {
    expect(isOlderThan(1000, 1000 + 30 * DAY)).toBe(false);
    expect(isOlderThan(1000, 1000 + 30 * DAY + 1)).toBe(true);
    expect(isOlderThan(null, 1e9)).toBe(false);
  });
  it('a KRS from another semester than the academic calendar', () => {
    const now = { tahunAjaran: '2026/2027', semester: 'awal' as const };
    expect(fromOtherSemester({ tahunAjaran: '2026/2027', jenis: 'Ganjil' }, now)).toBe(false);
    expect(fromOtherSemester({ tahunAjaran: '2026/2027', jenis: 'Genap' }, now)).toBe(true);
    expect(fromOtherSemester({ tahunAjaran: '2025/2026', jenis: 'Ganjil' }, now)).toBe(true);
    expect(fromOtherSemester({ tahunAjaran: '2026/2027', jenis: 'awal' }, now)).toBe(false);
    expect(fromOtherSemester({ tahunAjaran: null, jenis: 'Ganjil' }, now)).toBeNull();
    expect(fromOtherSemester({ tahunAjaran: '2026/2027', jenis: 'Ganjil' }, null)).toBeNull();
  });
});

describe('nudges: grade season and KRS opening, once per period', () => {
  const TZ = 'Asia/Makassar';
  const k = (id: string, kategori: Kegiatan['kategori'], mulai: string, selesai: string): Kegiatan => ({ id, kategori, mulai, selesai, judul: id, perkiraan: false, audiens: 'mahasiswa' }) as unknown as Kegiatan;
  const kegiatan = [k('input-nilai', 'nilai', '2026-12-07', '2026-12-20'), k('krs-akhir', 'krs', '2027-01-03', '2027-02-12'), k('uas', 'uas', '2026-11-30', '2026-12-05')];
  const nudges = neosiaNudges(kegiatan, DEFAULT_CALENDAR_NOTIFY);
  const base = { timeZone: TZ, tasks: [], taskState: {}, activeCourseIds: new Set<number>(), settings: DEFAULT_REMINDERS, session: { state: 'OK' as const, expiredAt: null }, nudges };
  const morning = DEFAULT_REMINDERS.snoozeMorningMin;

  it('takes grade input, appeals and KRS windows; not other events; follows the calendar settings', () => {
    expect(nudges.map((n) => [n.id, n.nudge])).toEqual([
      ['input-nilai', 'grades'],
      ['krs-akhir', 'krs'],
    ]);
    expect(neosiaNudges(kegiatan, { ...DEFAULT_CALENDAR_NOTIFY, krs: false, sanggah: false })).toEqual([]);
  });

  it('sends one per period from the morning of its first day, then never again', () => {
    const first = planReminders({ ...base, sent: {}, now: zonedToUnix('2026-12-07', morning + 1, TZ) });
    expect(first.send).toEqual([{ kind: 'nudge', key: 'nudge:grades:input-nilai', nudge: 'grades' }]);
    const sent = Object.fromEntries(first.markSent.map((x) => [x, 1]));
    const again = planReminders({ ...base, sent, now: zonedToUnix('2026-12-10', morning + 1, TZ) });
    expect(again.send.filter((n) => n.kind === 'nudge')).toEqual([]);
  });

  it('a browser opened later in the period still gets it once; after the period it is dropped', () => {
    expect(planReminders({ ...base, sent: {}, now: zonedToUnix('2026-12-15', 14 * 60, TZ) }).send.map((n) => n.kind === 'nudge' && n.nudge)).toEqual(['grades']);
    const late = planReminders({ ...base, sent: {}, now: zonedToUnix('2026-12-25', 14 * 60, TZ) });
    expect(late.send.filter((n) => n.kind === 'nudge')).toEqual([]);
    expect(late.markSent).toContain('nudge:grades:input-nilai');
  });

  it('KRS opening: one notification on its first day', () => {
    const plan = planReminders({ ...base, sent: { 'nudge:grades:input-nilai': 1 }, now: zonedToUnix('2027-01-03', morning + 1, TZ) });
    expect(plan.send.filter((n) => n.kind === 'nudge')).toEqual([{ kind: 'nudge', key: 'nudge:krs:krs-akhir', nudge: 'krs' }]);
  });
});
