import { describe, expect, it } from 'vitest';
import { DEFAULT_GROUP_FILTER, calendarEvents } from '../lib/calendar/groups';
import { bundledCalendar } from '../lib/calendar/remote';
import { DEFAULT_CALENDAR_NOTIFY } from '../lib/calendar/notify-settings';

const BUNDLED_CALENDAR = bundledCalendar();
import { ENDPOINTS, type EndpointId } from '../lib/neosia/allowlist';
import { linkCourse } from '../lib/neosia/course-map';
import { gradeChanges } from '../lib/neosia/grades';
import { linkedMeetings } from '../lib/neosia/linked';
import { projectResponse, type Projected } from '../lib/neosia/project';
import { holidayRanges, mondayOf, occurrences, scheduleIcs, semesterRange } from '../lib/neosia/schedule';
import type { NeosiaSnapshot, Snapshots } from '../lib/neosia/store';
import { classMeetings, krsStatus, krsWindow, krsWindows, newGrades, paymentPaid, pickWindow, profile, readiness, showKrsCard, surveyFilled, weekdayOf, type KrsWindow } from '../lib/neosia/view';
import { planReminders } from '../lib/reminders/plan';
import { DEFAULT_REMINDERS } from '../lib/reminders/settings';
import { noticeView } from '../lib/reminders/text';
import { messagesFor } from '../lib/i18n';
import { zonedToUnix } from '../lib/reminders/zoned';
import type { CourseRecord } from '../lib/types';
import { SYNTHETIC } from './neosia-synthetic';

const TZ = 'Asia/Makassar';

function snap(endpoint: EndpointId, data: Projected | null): NeosiaSnapshot {
  return { endpoint, v: 1, data, changedAt: 100, seenAt: 100, unknownShapeAt: null };
}

function projected(endpoint: EndpointId, raw: unknown = SYNTHETIC[endpoint]): Projected {
  const r = projectResponse(ENDPOINTS.find((e) => e.id === endpoint)!.spec, raw);
  if (r.status !== 'ok') throw new Error(endpoint);
  return r.data;
}

const all: Snapshots = Object.fromEntries(ENDPOINTS.map((e) => [e.id, snap(e.id, projected(e.id))]));

function course(id: number, code: string, cls: string | null, inProgress = true): CourseRecord {
  return { id, fullname: `X [${code}]`, shortname: 'x', startdate: 0, enddate: 0, parsed: { name: `MATA KULIAH ${id}`, classLetter: cls, program: null, code, matched: true }, inProgress, past: false, activeScore: 1, activeReasons: [], activePin: true, alias: null, color: null };
}

describe('KRS windows and readiness', () => {
  const win = (start: string, end: string, caption: string | null = 'Pengisian KRS'): KrsWindow => ({ start, end, caption, source: 'neosia' });

  it('reads every window with its caption (filling in and changes)', () => {
    expect(krsWindows(all)).toEqual([win('2027-01-03', '2027-02-12'), win('2027-02-22', '2027-03-01', 'Perubahan KRS')]);
  });

  it('0 windows: nothing from NEOSIA, the academic calendar fills in, else unknown', () => {
    expect(pickWindow([], '2026-12-01')).toBeNull();
    expect(krsWindow({}, '2026-12-01', [{ mulai: '2027-01-03', selesai: '2027-02-12' }])).toEqual({ start: '2027-01-03', end: '2027-02-12', caption: null, source: 'calendar' });
    expect(krsWindow({}, '2026-12-01', [])).toBeNull();
    expect(readiness({}, null, '2026-12-01')[0]).toMatchObject({ id: 'window', state: 'unknown' });
  });

  it('1 window: shown from 14 days before until it closes', () => {
    const w = pickWindow([win('2027-01-03', '2027-02-12')], '2026-12-01');
    expect(showKrsCard(w, '2026-12-19')).toBe(false);
    expect(showKrsCard(w, '2026-12-20')).toBe(true);
    expect(showKrsCard(w, '2027-02-12')).toBe(true);
    expect(showKrsCard(w, '2027-02-13')).toBe(false);
  });

  it('3 windows (passed, open, coming): the open one, then the nearest coming one, else the last', () => {
    const three = [win('2026-08-01', '2026-08-14', 'Pengisian KRS lalu'), win('2027-01-03', '2027-02-12'), win('2027-02-22', '2027-03-01', 'Perubahan KRS')];
    expect(pickWindow(three, '2027-01-10')?.caption).toBe('Pengisian KRS');
    expect(pickWindow(three, '2027-02-15')?.caption).toBe('Perubahan KRS');
    expect(pickWindow(three, '2026-12-01')?.caption).toBe('Pengisian KRS');
    expect(pickWindow(three, '2027-03-05')?.caption).toBe('Perubahan KRS');
    expect(readiness(all, pickWindow(three, '2027-02-15'), '2027-02-15')[0]).toMatchObject({ phase: 'before', window: { caption: 'Perubahan KRS' } });
  });

  it('lists every item; missing data is "unknown", never a guess; no advisor item', () => {
    const items = readiness(all, krsWindow(all, '2027-01-05', []), '2027-01-05');
    expect(items.map((i) => [i.id, i.state])).toEqual([
      ['window', 'info'],
      ['payment', 'ok'],
      ['survey', 'action'],
      ['sks', 'info'],
      ['krs', 'ok'],
    ]);
    expect(readiness({}, null, '2027-01-05').every((i) => i.state === 'unknown')).toBe(true);
  });

  it('reads payment and survey without amounts or ids', () => {
    expect(paymentPaid(all)).toBe(true);
    expect(paymentPaid({ getStatusPembayaran: snap('getStatusPembayaran', { pembayaran: { sudah_bayar: false } }) })).toBe(false);
    expect(paymentPaid({ dashboard: snap('dashboard', { pembayaran: { sudah_bayar: true } }) })).toBe(true);
    expect(surveyFilled(all)).toBe(false);
  });

  it('KRS status: approved, locked, submitted (current, not approved), empty', () => {
    const krs = (k: Record<string, Projected>) => krsStatus({ belanja_krs: snap('belanja_krs', { kartu_rencana_studi: k }) });
    const cls = [{ nama: 'A', is_batal: false }];
    expect(krs({ is_approved: true, is_locked: false, is_current: true, kelas_kuliahs: cls })).toBe('approved');
    expect(krs({ is_approved: true, is_locked: true, is_current: true, kelas_kuliahs: cls })).toBe('locked');
    expect(krs({ is_approved: false, is_locked: false, is_current: true, kelas_kuliahs: cls })).toBe('submitted');
    expect(krs({ is_approved: false, is_locked: false, is_current: true, kelas_kuliahs: [] })).toBe('empty');
    expect(krs({ is_approved: false, is_locked: false, is_current: true, kelas_kuliahs: [{ nama: 'A', is_batal: true }] })).toBe('empty');
    expect(krs({ is_approved: false, is_locked: false, is_current: false, kelas_kuliahs: cls })).toBeNull();
  });
});

describe('schedule', () => {
  it('reads meetings from the KRS: class name, credits, day, time, room, lecturer names only', () => {
    const meetings = classMeetings(all);
    // The cancelled class (is_batal) is left out; credits come from the summed jumlah_sks.
    expect(meetings.map((m) => [m.code, m.className, m.sks, m.weekday, m.start, m.end, m.room, m.lecturers])).toEqual([
      ['23D12100001', 'A', 3, 1, '07:30', '10:00', 'Ruang Kuliah 101', ['Dosen Satu']],
      ['23D12100002', 'B', 2, 3, '13:00', '14:40', 'Lab Komputer 2', ['Dosen Dua']],
    ]);
  });

  it('day_of_week: 1 = Monday … 7 or 0 = Sunday (to be verified)', () => {
    expect([1, 6, 7, 0, 8, 'x'].map((v) => weekdayOf(v as Projected))).toEqual([1, 6, 0, 0, null, null]);
  });

  it('marks meetings on holidays and lists a week from Monday', () => {
    const holidays = [{ mulai: '2027-02-15', selesai: '2027-02-15', nama: 'Libur contoh' }];
    const meetings = classMeetings(all);
    const week = occurrences(meetings, '2027-02-15', '2027-02-20', holidays);
    expect(week.map((o) => [o.day, o.meeting.code, o.holiday])).toEqual([
      ['2027-02-15', '23D12100001', 'Libur contoh'],
      ['2027-02-17', '23D12100002', null],
    ]);
    expect(mondayOf('2027-02-21')).toBe('2027-02-15');
    expect(mondayOf('2027-02-15')).toBe('2027-02-15');
  });

  it('builds a local recurring ICS per meeting with the Makassar time zone, or null without teaching weeks', () => {
    const range = semesterRange(BUNDLED_CALENDAR, '2026-08-20');
    expect(range?.semester).toBe('awal');
    const ics = scheduleIcs(classMeetings(all), BUNDLED_CALENDAR, range, { tahunAjaran: '2026/2027', jenis: 'awal' }, '20261118T000000Z')!;
    expect(ics).toContain('BEGIN:VTIMEZONE');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=');
    expect(ics).toContain('UID:jadwal-23d12100001-a-2026-2027-awal-0@sulo');
    expect(ics).not.toMatch(/nilai|ipk|ips/i);
    expect(scheduleIcs(classMeetings(all), BUNDLED_CALENDAR, null, { tahunAjaran: null, jenis: null }, '20261118T000000Z')).toBeNull();
  });

  it('puts classes into the calendar only with the Kuliah chip on, which is off by default', () => {
    expect(DEFAULT_GROUP_FILTER.kuliah).toBe(false);
    const classes = [{ id: 'k1', dateKey: '2027-02-15', name: 'Mekanika Fluida', courseColor: 2, start: '07:30', end: '10:00', room: null, holiday: null }];
    expect(calendarEvents(BUNDLED_CALENDAR, [], DEFAULT_GROUP_FILTER, { classes }).some((e) => e.group === 'kuliah')).toBe(false);
    expect(calendarEvents(BUNDLED_CALENDAR, [], { ...DEFAULT_GROUP_FILTER, kuliah: true }, { classes }).filter((e) => e.group === 'kuliah')).toHaveLength(1);
  });

  it('holiday ranges come from national holidays and calendar holidays', () => {
    expect(holidayRanges(BUNDLED_CALENDAR).length).toBeGreaterThan(5);
  });
});

describe('linking NEOSIA classes to SIKOLA courses', () => {
  const courses = [course(1, '23D12100001', 'B'), course(2, '23D12100001', 'A'), course(3, '23D12100002', null)];

  it('links by code, preferring the same class letter', () => {
    expect(linkCourse({ code: '23D12100001', name: 'X', className: 'A' }, courses, {})?.course.id).toBe(2);
    expect(linkCourse({ code: '23D12100002', name: 'X', className: 'B' }, courses, {})?.course.id).toBe(3);
    expect(linkCourse({ code: '23D99999999', name: 'X', className: null }, courses, {})).toBeNull();
  });

  it('a manual choice wins, and "not linked" is respected', () => {
    expect(linkCourse({ code: '23D12100001', name: 'X', className: 'A' }, courses, { '23D12100001': 3 })).toMatchObject({ how: 'manual', course: { id: 3 } });
    expect(linkCourse({ code: '23D12100001', name: 'X', className: 'A' }, courses, { '23D12100001': null })).toBeNull();
  });

  it('gives linked meetings the course name and color', () => {
    const [first] = linkedMeetings(classMeetings(all), courses, {});
    expect(first).toMatchObject({ displayName: 'Mata Kuliah 2', how: 'code' });
    expect(first!.color).not.toBeNull();
  });
});

describe('profile', () => {
  it('reads semester, credits and GPA; semester falls back to the study period', () => {
    expect(profile(all)).toEqual({ semester: 4, sksPassed: 64, ipk: 3.51, ips: 3.6, masaStudi: { maksimal: 14, sisa: 10 } });
    expect(profile({ 'indeks_prestasi/current': all['indeks_prestasi/current']! })).toMatchObject({ ipk: 3.51, ips: 3.6, sksPassed: 64 });
    const withoutContext = { dashboard: all.dashboard! };
    expect(profile(withoutContext)?.semester).toBe(5);
    expect(profile({})).toBeNull();
  });
});

describe('new grades', () => {
  const t0 = projected('getTranskripMahasiswa');
  const added = projected('getTranskripMahasiswa', {
    transkrip: [...(SYNTHETIC.getTranskripMahasiswa as { transkrip: object[] }).transkrip, { kode_mata_kuliah: '23D12100002', nama_mata_kuliah: 'STATISTIKA', sks: 2, nilai_huruf: 'A', id_semester: 20261 }],
  });

  it('finds rows that gained a letter, keyed by code and semester', () => {
    expect(newGrades(t0, added).map((r) => r.key)).toEqual(['23D12100002|20261']);
    expect(newGrades(t0, t0)).toEqual([]);
  });

  it('turns them into "Kabar terbaru" entries with the course only, never the letter, and not on a baseline', () => {
    const courses = [course(9, '23D12100002', null)];
    const stored = { kind: 'stored' as const, endpoint: 'getTranskripMahasiswa' as const, previous: snap('getTranskripMahasiswa', t0), next: snap('getTranskripMahasiswa', added), changed: true, baseline: false };
    const changes = gradeChanges(stored, courses, {});
    expect(changes).toEqual([{ kind: 'neosia_grade', courseId: 9, key: '23D12100002|20261', name: 'Mata Kuliah 9' }]);
    expect(JSON.stringify(changes)).not.toMatch(/"A"|nilai_huruf/);
    expect(gradeChanges({ ...stored, baseline: true }, courses, {})).toEqual([]);
  });

  it('notifies "Nilai baru keluar untuk …" without the letter', () => {
    const m = messagesFor('id');
    const entry = { id: 'neosia:grade:x', at: 1, change: { kind: 'neosia_grade' as const, courseId: 9, key: 'x', name: 'Statistika' }, notify: true, seen: false, opens: 0 };
    const view = noticeView({ kind: 'changes', key: entry.id, courseId: 9, entries: [entry] }, { now: 1, timeZone: TZ, m, courseName: () => '' });
    expect(view.title).toBe('Nilai baru keluar untuk Statistika');
    expect(`${view.title} ${view.message}`).not.toMatch(/\bA\b|nilai huruf/);
  });
});

describe('KRS closing reminders', () => {
  const base = {
    timeZone: TZ,
    tasks: [],
    taskState: {},
    activeCourseIds: new Set<number>(),
    settings: DEFAULT_REMINDERS,
    sent: {},
    session: { state: 'OK' as const, expiredAt: null },
  };

  it('come 3 days and 1 day before the last day, at the morning time', () => {
    const at = (day: string, min: number) => zonedToUnix(day, min, TZ);
    const morning = DEFAULT_REMINDERS.snoozeMorningMin;
    const krsWindows = [{ start: '2027-01-03', end: '2027-02-12', caption: 'Pengisian KRS' }];
    const h3 = planReminders({ ...base, now: at('2027-02-09', morning + 1), krsWindows });
    expect(h3.send).toEqual([{ kind: 'krs', key: 'krs:2027-01-03:2027-02-12:h3', stage: 'h3', end: '2027-02-12', caption: 'Pengisian KRS' }]);
    const h1 = planReminders({ ...base, now: at('2027-02-11', morning + 1), krsWindows, sent: { 'krs:2027-01-03:2027-02-12:h3': 1 } });
    expect(h1.send.map((n) => n.kind === 'krs' && n.stage)).toEqual(['h1']);
    const early = planReminders({ ...base, now: at('2027-02-01', 600), krsWindows });
    expect(early.send).toEqual([]);
    expect(early.nextAt).toBe(at('2027-02-09', morning));
  });

  it('respect quiet hours', () => {
    const quiet = { ...DEFAULT_REMINDERS, snoozeMorningMin: 23 * 60, quiet: { enabled: true, startMin: 22 * 60, endMin: 6 * 60 } };
    const plan = planReminders({ ...base, settings: quiet, now: zonedToUnix('2027-02-09', 23 * 60 + 5, TZ), krsWindows: [{ start: '2027-01-03', end: '2027-02-12', caption: null }] });
    expect(plan.send).toEqual([]);
    expect(plan.nextAt).toBe(zonedToUnix('2027-02-10', 6 * 60, TZ));
  });

  it('replace the calendar\'s own "KRS ends tomorrow" while NEOSIA has the window', () => {
    const krsEvent = { id: 'krs-1', judul: 'Pengisian KRS', mulai: '2027-01-03', selesai: '2027-02-12', kategori: 'krs' as const, perkiraan: false, audiens: 'mahasiswa' as const };
    const calendar = { events: [krsEvent], settings: DEFAULT_CALENDAR_NOTIFY, source: 'SK' };
    const now = zonedToUnix('2027-02-11', DEFAULT_REMINDERS.snoozeMorningMin + 1, TZ);
    const plan = planReminders({ ...base, now, calendar, krsWindows: [{ start: '2027-01-03', end: '2027-02-12', caption: null }], sent: { 'krs:2027-01-03:2027-02-12:h3': 1 } });
    expect(plan.send.map((n) => n.kind)).toEqual(['krs']);
  });

  it('each window has its own pair, the change window included, titled with its caption', () => {
    const krsWindows = [
      { start: '2027-01-03', end: '2027-02-12', caption: 'Pengisian KRS' },
      { start: '2027-02-22', end: '2027-03-01', caption: 'Perubahan KRS' },
    ];
    const morning = DEFAULT_REMINDERS.snoozeMorningMin;
    const plan = planReminders({ ...base, now: zonedToUnix('2027-02-26', morning + 1, TZ), krsWindows, sent: { 'krs:2027-01-03:2027-02-12:h3': 1, 'krs:2027-01-03:2027-02-12:h1': 1 } });
    expect(plan.send).toEqual([{ kind: 'krs', key: 'krs:2027-02-22:2027-03-01:h3', stage: 'h3', end: '2027-03-01', caption: 'Perubahan KRS' }]);
    const view = noticeView(plan.send[0]!, { now: 1, timeZone: TZ, m: messagesFor('id'), courseName: () => '' });
    expect(view.title).toBe('Perubahan KRS ditutup 3 hari lagi');
  });
});

describe('credits to graduate (Settings > NEOSIA)', () => {
  it('is 144 by default and only 100 to 200 are kept', async () => {
    const { readPrefs } = await import('../lib/prefs');
    const { memoryStore } = await import('./helpers');
    expect((await readPrefs(memoryStore())).sksTarget).toBe(144);
    expect((await readPrefs(memoryStore({ 'global:prefs': { sksTarget: 160 } }))).sksTarget).toBe(160);
    for (const bad of [99, 201, 150.5, 'x']) expect((await readPrefs(memoryStore({ 'global:prefs': { sksTarget: bad } }))).sksTarget).toBe(144);
  });
});
