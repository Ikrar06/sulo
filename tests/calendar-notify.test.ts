import { describe, expect, it } from 'vitest';
import { calendarHighlight } from '../lib/calendar/highlight';
import { groupByMonth, itemsOnDay, mentionsAngkatan, monthGrid, shiftMonth, DEFAULT_CALENDAR_FILTER } from '../lib/calendar/month';
import { calendarReminders, notifyKindOf, type CalendarEventLite } from '../lib/calendar/notify';
import { DEFAULT_CALENDAR_NOTIFY } from '../lib/calendar/notify-settings';
import { bundledCalendar } from '../lib/calendar/remote';
import { id } from '../lib/i18n/id';
import { en } from '../lib/i18n/en';
import { planReminders, type PlanInput } from '../lib/reminders/plan';
import { DEFAULT_REMINDERS } from '../lib/reminders/settings';
import { noticeView } from '../lib/reminders/text';
import { zonedToUnix } from '../lib/reminders/zoned';
import { DEFAULT_SYNC_STATUS, DEFAULTS } from '../lib/storage';
import { DEFAULT_REMOTE_CONFIG } from '../lib/remote/remote-config';
import { buildPopupView } from '../lib/view/popup-view';

const TZ = 'Asia/Makassar';
const cal = bundledCalendar();
const at = (day: string, hour: number, minute = 0) => zonedToUnix(day, hour * 60 + minute, TZ);
const SOURCE = 'SK Rektor No. 08429/UN4.1/KEP/2026';

const plan = (now: number, sent: Record<string, number> = {}, patch: Partial<PlanInput> = {}) =>
  planReminders({
    now,
    timeZone: TZ,
    tasks: [],
    taskState: {},
    activeCourseIds: new Set(),
    settings: DEFAULT_REMINDERS,
    sent,
    session: { state: 'OK', expiredAt: null },
    calendar: { events: cal.kegiatan, settings: DEFAULT_CALENDAR_NOTIFY, source: SOURCE },
    ...patch,
  });

const byTitle = (judul: string, mulai: string) => cal.kegiatan.find((k) => k.judul === judul && k.mulai === mulai)!;

describe('which calendar events notify', () => {
  it('kinds from the data: KRS, UKT, UTS, UAS, drop or swap, withdrawal; nothing else', () => {
    const kinds = new Map<string, number>();
    for (const k of cal.kegiatan) {
      const kind = notifyKindOf(k);
      if (kind) kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    }
    expect(Object.fromEntries(kinds)).toEqual({ krs: 2, ukt: 2, uts: 2, uas: 2, pembatalan: 2, pengunduran: 2 });
  });

  it('estimates and admissions never notify', () => {
    const base = byTitle('Pengisian KRS daring Semester Akhir', '2027-01-03');
    expect(notifyKindOf({ ...base, perkiraan: true })).toBeNull();
    expect(notifyKindOf({ ...base, audiens: 'calon_mahasiswa' })).toBeNull();
    expect(notifyKindOf({ ...base, kategori: 'sanggah', judul: 'Masa sanggah nilai' })).toBe('sanggah');
  });

  it('H-7 for KRS, UKT and UAS; H-1 for all; before the last day of a window, not of an exam week', () => {
    const krs = byTitle('Pengisian KRS daring Semester Akhir', '2027-01-03');
    const uts = byTitle('Ujian tengah semester (UTS)', '2027-04-05');
    const drop = byTitle('Batas akhir pembatalan/penggantian mata kuliah', '2027-02-27');
    const r = calendarReminders([krs, uts, drop], DEFAULT_CALENDAR_NOTIFY);
    expect(r.map((x) => [x.kind, x.stage, x.day])).toEqual([
      ['krs', 'h7', '2026-12-27'],
      ['krs', 'h1', '2027-01-02'],
      ['krs', 'h1-akhir', '2027-02-11'],
      ['uts', 'h1', '2027-04-04'],
      ['pembatalan', 'h1', '2027-02-26'],
    ]);
    expect(new Set(r.map((x) => x.key)).size).toBe(r.length);
    expect(r[0]!.key).toBe(`k:${krs.id}:h7:2026-12-27`);
  });

  it('a kind turned off in the settings gives nothing', () => {
    const krs = byTitle('Pengisian KRS daring Semester Akhir', '2027-01-03');
    expect(calendarReminders([krs], { ...DEFAULT_CALENDAR_NOTIFY, krs: false })).toEqual([]);
  });
});

describe('calendar reminders in the planner (M3 engine)', () => {
  const krs = byTitle('Pengisian KRS daring Semester Akhir', '2027-01-03');
  const key = `k:${krs.id}:h1:2027-01-02`;

  it('sends on its day at the morning time, records the key, and never twice', () => {
    const early = plan(at('2027-01-02', 6, 30));
    expect(early.send.filter((n) => n.kind === 'calendar')).toEqual([]);
    expect(early.nextAt).toBe(at('2027-01-02', 7));
    const due = plan(at('2027-01-02', 7, 5));
    expect(due.send).toEqual([{ kind: 'calendar', key, stage: 'h1', event: krs, source: SOURCE }]);
    expect(due.markSent).toContain(key);
    expect(plan(at('2027-01-02', 9), { [key]: at('2027-01-02', 7, 5) }).send.filter((n) => n.kind === 'calendar')).toEqual([]);
  });

  it('a reminder missed while the browser was closed is dropped, not sent late', () => {
    const later = plan(at('2027-01-03', 8));
    expect(later.send.some((n) => n.kind === 'calendar' && n.key === key)).toBe(false);
    expect(later.markSent).toContain(key);
  });

  it('quiet hours hold it until they end that day', () => {
    const settings = { ...DEFAULT_REMINDERS, quiet: { enabled: true, startMin: 22 * 60, endMin: 9 * 60 } };
    const held = plan(at('2027-01-02', 7, 30), {}, { settings });
    expect(held.send.some((n) => n.kind === 'calendar')).toBe(false);
    expect(held.nextAt).toBe(at('2027-01-02', 9));
    expect(plan(at('2027-01-02', 9, 1), {}, { settings }).send.some((n) => n.kind === 'calendar')).toBe(true);
  });

  it('task reminders being off does not silence calendar reminders', () => {
    const off = plan(at('2027-01-02', 8), {}, { settings: { ...DEFAULT_REMINDERS, enabled: false } });
    expect(off.send.some((n) => n.kind === 'calendar')).toBe(true);
  });

  it('text names the event, the dates and a short source, in both languages', () => {
    const notice = plan(at('2027-01-02', 8)).send.find((n) => n.kind === 'calendar')!;
    const ctx = { now: at('2027-01-02', 8), timeZone: TZ, courseName: () => '' };
    expect(noticeView(notice, { ...ctx, m: id })).toEqual({
      title: 'Pengisian KRS daring Semester Akhir mulai besok',
      message: '3 Jan sampai 12 Feb 2027. Sumber: kalender akademik Unhas, SK Rektor No. 08429/UN4.1/KEP/2026.',
      icon: 'urgent',
      buttons: [],
    });
    expect(noticeView(notice, { ...ctx, m: en }).title).toBe('Pengisian KRS daring Semester Akhir starts tomorrow');
    const single = plan(at('2027-02-26', 8)).send.find((n) => n.kind === 'calendar')!;
    expect(noticeView(single, { ...ctx, m: id }).title).toBe('Besok: Batas akhir pembatalan/penggantian mata kuliah');
  });
});

describe('popup "Tanggal penting" line', () => {
  it('the background picks the nearest date; nothing once the calendar is out of date', () => {
    expect(calendarHighlight(cal, '2026-11-16')).toMatchObject({ judul: 'Ujian final (UAS)', mulai: '2026-11-30' });
    expect(calendarHighlight(cal, '2027-07-01')).toBeNull();
  });

  it('the popup shows it with a countdown, only once set up', () => {
    const input = {
      user: { ...DEFAULTS, onboarding: { completedAt: 1, confirmedInProgress: [], reviewSuggested: [] } },
      session: 'OK' as const,
      syncStatus: DEFAULT_SYNC_STATUS,
      remoteConfig: DEFAULT_REMOTE_CONFIG,
      budget: { date: '2026-11-16', used: 0 },
      budgetLimit: 40,
      now: at('2026-11-16', 10),
      timeZone: TZ,
      calendarHighlight: calendarHighlight(cal, '2026-11-16'),
    };
    expect(buildPopupView(input).important).toEqual({ judul: 'Ujian final (UAS)', countdown: { kind: 'days', n: 14 } });
    expect(buildPopupView({ ...input, user: DEFAULTS }).important).toBeNull();
  });
});

describe('month and list helpers', () => {
  it('Monday-first weeks covering the month', () => {
    const weeks = monthGrid('2026-11');
    expect(weeks[0]![0]).toBe('2026-10-26');
    expect(weeks.at(-1)!.at(-1)).toBe('2026-12-06');
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
  });

  it('a day lists holidays, events and task deadlines; estimates stay out of the month grid', () => {
    const tasks = [{ type: 'tugas' as const, eventId: 1, name: 'Laporan', courseName: 'Hidrologi', courseColor: 2, dateKey: '2026-12-25' }];
    // Christmas: inside the semester break and the grade-change window.
    const items = itemsOnDay('2026-12-25', cal, DEFAULT_CALENDAR_FILTER, tasks);
    expect(items.map((i) => i.type)).toEqual(['libur', 'kegiatan', 'kegiatan', 'tugas']);
    expect(itemsOnDay('2026-12-15', cal, DEFAULT_CALENDAR_FILTER, []).some((i) => i.type === 'kegiatan' && i.kegiatan.kategori === 'kkn')).toBe(false);
    expect(itemsOnDay('2026-10-06', cal, { ...DEFAULT_CALENDAR_FILTER, kategori: 'uts' }, [{ ...tasks[0]!, dateKey: '2026-10-06' }]).map((i) => i.type)).toEqual(['kegiatan']);
  });

  it('intake year matches the evaluation details exactly', () => {
    const evaluation = byTitle('Evaluasi masa studi dan kelanjutan studi (angkatan dan jenjang yang dievaluasi tercantum di PDF)', '2026-07-17');
    expect(mentionsAngkatan(evaluation, 2024)).toBe(true);
    expect(mentionsAngkatan(evaluation, 2020)).toBe(true);
    expect(mentionsAngkatan(evaluation, 2026)).toBe(false);
    expect(mentionsAngkatan(evaluation, null)).toBe(false);
  });

  it('list groups by starting month, in order', () => {
    const groups = groupByMonth(cal.kegiatan);
    expect(groups[0]!.month).toBe('2026-06');
    expect(groups.map((g) => g.month)).toEqual([...groups.map((g) => g.month)].sort());
  });
});

// The lite shape is all a notice keeps from the calendar file.
const _lite: CalendarEventLite = cal.kegiatan[0]!;
void _lite;

describe('title shortening (word boundary + "…")', () => {
  it('keeps a title that fits, untouched', async () => {
    const { shorten } = await import('../lib/reminders/text');
    expect(shorten('Ujian final (UAS)', 64)).toBe('Ujian final (UAS)');
  });
  it('cuts at the last whole word and never goes over the limit', async () => {
    const { shorten } = await import('../lib/reminders/text');
    const long = 'Mahasiswa yang memiliki surat izin ujian atau surat pendaftaran wisuda tidak dikenakan UKT Semester Awal';
    const out = shorten(long, 64);
    expect(out).toBe('Mahasiswa yang memiliki surat izin ujian atau surat pendaftaran…');
    expect(out.length).toBeLessThanOrEqual(64);
    expect(shorten('Batas akhir pembatalan/penggantian mata kuliah', 40)).toBe('Batas akhir pembatalan/penggantian mata…');
  });
  it('drops trailing punctuation before the ellipsis', async () => {
    const { shorten } = await import('../lib/reminders/text');
    expect(shorten('Laporan praktikum, revisi kedua dan ketiga', 22)).toBe('Laporan praktikum…');
  });
  it('a single word longer than the limit is cut inside the word', async () => {
    const { shorten } = await import('../lib/reminders/text');
    expect(shorten('Pneumonoultramicroscopicsilicovolcanoconiosis', 20)).toBe('Pneumonoultramicros…');
  });
});
