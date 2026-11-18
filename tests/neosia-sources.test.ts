import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR_NOTIFY } from '../lib/calendar/notify-settings';
import { NEOSIA_HOME, NEOSIA_KHS, NEOSIA_KRS, NEOSIA_TRANSKRIP } from '../lib/links';
import { CAPTURE_SCHEMA_VERSION, type EndpointId } from '../lib/neosia/allowlist';
import { connectFlow } from '../lib/neosia/connect-flow';
import { neosiaNudges } from '../lib/neosia/nudges';
import { arrivalMessage, arrivals, CHECKLIST_SOURCES, completion, fromOtherSemester, isOlderThan, SOURCES, sourceStatuses } from '../lib/neosia/sources';
import type { NeosiaSnapshot, Snapshots } from '../lib/neosia/store';
import { planReminders } from '../lib/reminders/plan';
import { DEFAULT_REMINDERS } from '../lib/reminders/settings';
import { zonedToUnix } from '../lib/reminders/zoned';
import type { Kegiatan } from '../lib/calendar/schema';

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
  it('opens the transcript only after the permission is given and the module is on', async () => {
    expect(await run(true)).toEqual({ o: 'connected', opened: [NEOSIA_TRANSKRIP] });
  });
  it('opens nothing when the permission is refused or the module fails', async () => {
    expect(await run(false)).toEqual({ o: 'denied', opened: [] });
    expect(await run('throw')).toEqual({ o: 'failed', opened: [] });
    expect(await run(true, 'failed')).toEqual({ o: 'failed', opened: [] });
  });
});

describe('"Lengkapi data dari NEOSIA"', () => {
  it('lists four pages (not the course list) with their NEOSIA URLs', () => {
    expect(CHECKLIST_SOURCES.map((s) => [s.id, s.url])).toEqual([
      ['beranda', NEOSIA_HOME],
      ['transkrip', NEOSIA_TRANSKRIP],
      ['krs', NEOSIA_KRS],
      ['khs', NEOSIA_KHS],
    ]);
    expect(SOURCES.find((s) => s.id === 'matakuliah')?.checklist).toBe(false);
  });
  it('marks a page done when its main response is stored, and counts "x of 4"', () => {
    expect(completion(sourceStatuses({}))).toEqual({ done: 0, total: 4, complete: false });
    const two: Snapshots = { dashboard: snap('dashboard', 50), getStatusPembayaran: snap('getStatusPembayaran', 70), belanja_krs: snap('belanja_krs') };
    const statuses = sourceStatuses(two);
    expect(statuses.map((s) => [s.source.id, s.has, s.seenAt])).toEqual([
      ['beranda', true, 50],
      ['transkrip', false, null],
      ['krs', true, 100],
      ['khs', false, null],
    ]);
    expect(completion(statuses)).toEqual({ done: 2, total: 4, complete: false });
    const all: Snapshots = { ...two, getTranskripMahasiswa: snap('getTranskripMahasiswa'), 'kartu_hasil_studi/semester': snap('kartu_hasil_studi/semester') };
    expect(completion(sourceStatuses(all)).complete).toBe(true);
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
