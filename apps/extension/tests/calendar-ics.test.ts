import { describe, expect, it } from 'vitest';
import { addDays, weekday } from '@sulo/core/calendar/dates';
import { buildFeed, buildIcs, escapeText, feedEvents, foldLine } from '@sulo/core/calendar/ics';
import { CALENDAR_FILE_KEY, CALENDAR_KEY, bundledCalendar, readCalendar, refreshCalendar } from '@sulo/core/calendar/remote';
import { buildRecurringEvent, expandOccurrences, planRecurrence, VTIMEZONE_MAKASSAR, type RecurringClass } from '@sulo/core/calendar/rrule';
import { createScheduler } from '@sulo/core/net/scheduler';
import { fakeFetch, fixedClock, jsonResponse, memoryStore } from './helpers';

const cal = bundledCalendar();
const octets = (s: string) => new TextEncoder().encode(s).length;
const unfoldAll = (ics: string) => ics.replace(/\r\n /g, '');
const vevents = (ics: string) => unfoldAll(ics).split('BEGIN:VEVENT').slice(1);

describe('ICS writer', () => {
  it('escapes text and folds lines at 75 octets without splitting a character', () => {
    expect(escapeText('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne');
    const long = `SUMMARY:${'é'.repeat(60)}`;
    const folded = foldLine(long);
    for (const part of folded.split('\r\n')) expect(octets(part)).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(long);
  });

  it('one event: UID @sulo, exclusive DTEND, SEQUENCE and LAST-MODIFIED from the revision, CATEGORIES, URL, source in DESCRIPTION, no VALARM', () => {
    const uts = cal.kegiatan.find((k) => k.id.endsWith('awal-ujian-tengah-semester'))!;
    const ics = buildIcs([{ id: uts.id, judul: uts.judul, mulai: uts.mulai, selesai: uts.selesai, kategori: uts.kategori, keterangan: [] }], cal, { name: 'x', description: 'y' });
    const [event] = vevents(ics);
    expect(event).toContain(`UID:${uts.id}@sulo\r\n`);
    expect(event).toContain('DTSTART;VALUE=DATE:20261005\r\n');
    expect(event).toContain('DTEND;VALUE=DATE:20261010\r\n');
    expect(event).toContain('SEQUENCE:1\r\n');
    expect(event).toContain('LAST-MODIFIED:20261116T000000Z\r\n');
    expect(event).toContain('CATEGORIES:uts\r\n');
    expect(event).toContain(`URL:${cal.sumber.halaman_url}\r\n`);
    expect(event).toContain('08429/UN4.1/KEP/2026');
    expect(event).toContain('Tidak resmi');
    expect(ics).not.toContain('VALARM');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    for (const line of ics.split('\r\n')) expect(octets(line)).toBeLessThanOrEqual(75);
  });

  it('a later revision raises SEQUENCE for the same UID', () => {
    const one = buildFeed('wisuda', [cal]);
    const two = buildFeed('wisuda', [{ ...cal, revisi: 2, diperbarui: '2026-12-01' }]);
    expect(one).toContain('SEQUENCE:1');
    expect(two).toContain('SEQUENCE:2');
    expect(two).toContain('LAST-MODIFIED:20261201T000000Z');
    expect(vevents(one).map((e) => /UID:(.*)\r\n/.exec(e)?.[1])).toEqual(vevents(two).map((e) => /UID:(.*)\r\n/.exec(e)?.[1]));
  });

  it('an open-ended event is shown as its first day and says it has no end', () => {
    const feed = unfoldAll(buildFeed('inti-s1', [cal]));
    const event = feed.split('BEGIN:VEVENT').find((e) => e.includes('UID:2026-2027-libur-semester-setelah-akhir@sulo'))!;
    expect(event).toContain('DTSTART;VALUE=DATE:20270628');
    expect(event).toContain('DTEND;VALUE=DATE:20270629');
    expect(event).toContain('Tanggal akhir belum ada');
  });
});

describe('three feeds', () => {
  it('S1 core: no graduation, admissions, staff schedule input, or graduate-only events', () => {
    const { events } = feedEvents('inti-s1', [cal]);
    const cats = new Set(events.map((e) => e.kategori));
    for (const c of ['wisuda', 'penerimaan', 'jadwal']) expect(cats.has(c)).toBe(false);
    expect(events.some((e) => e.judul.startsWith('Kuliah perdana mahasiswa baru S3'))).toBe(false);
    for (const c of ['krs', 'uts', 'uas', 'perkuliahan', 'libur']) expect(cats.has(c)).toBe(true);
  });

  it('graduation: the nine periods', () => {
    expect(feedEvents('wisuda', [cal]).events).toHaveLength(9);
  });

  it('national holidays: the 18 from the PDF, each noting it is not yet checked against the SKB', () => {
    const { events } = feedEvents('libur-nasional', [cal]);
    expect(events).toHaveLength(18);
    expect(events.every((e) => e.keterangan.some((k) => k.includes('SKB')))).toBe(true);
    expect(events.find((e) => e.id.endsWith('idul-fitri'))).toMatchObject({ mulai: '2027-03-10', selesai: '2027-03-11' });
  });

  it('every UID is unique within a feed', () => {
    for (const feed of ['inti-s1', 'wisuda', 'libur-nasional'] as const) {
      const ids = feedEvents(feed, [cal]).events.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('recurring classes (RRULE, for M7)', () => {
  const awal = cal.pekan.awal!;
  const holidays = cal.libur_nasional.map((l) => ({ mulai: l.mulai, selesai: l.selesai }));
  const cls = (firstDate: string): RecurringClass => ({ uidBase: 'jadwal-tsi101-a-2026-2027-awal', summary: 'Mekanika Fluida (A)', firstDate, start: '08:00', end: '09:40' });
  const options = { pekan: awal, uasStart: '2026-11-30', holidays };

  it('UNTIL is UTC with Z, DTSTART and EXDATE carry the TZID, and a VTIMEZONE is available', () => {
    const lines = buildRecurringEvent(cls('2026-08-18'), options, '20261116T000000Z').join('\r\n').replace(/\r\n /g, '');
    expect(lines).toContain('DTSTART;TZID=Asia/Makassar:20260818T080000');
    expect(lines).toMatch(/RRULE:FREQ=WEEKLY;BYDAY=TU;UNTIL=20261129T155959Z/);
    expect(lines).toMatch(/EXDATE;TZID=Asia\/Makassar:20260825T080000,20261006T080000\r\n/);
    expect(VTIMEZONE_MAKASSAR).toContain('TZOFFSETTO:+0800');
  });

  it('a holiday on the meeting day is skipped (Maulid, Tuesday 25 Aug)', () => {
    expect(planRecurrence(cls('2026-08-18'), options).exdates).toContain('2026-08-25');
  });

  it('both defaults can be turned off', () => {
    const r = planRecurrence(cls('2026-08-18'), { ...options, excludeUtsWeek: false, endBeforeUas: false });
    expect(r.until).toBe('2026-12-06');
    expect(r.exdates).not.toContain('2026-10-06');
  });

  it('property: for any first meeting in week 1, meetings are weekly, never on a holiday, never in the UTS week, and end before UAS', () => {
    const utsMonday = awal.pekan[7]!.mulai;
    const isHoliday = (d: string) => holidays.some((h) => d >= h.mulai && d <= h.selesai);
    for (let i = 0; i < 6; i++) {
      const first = addDays('2026-08-17', i);
      const meetings = expandOccurrences(cls(first), planRecurrence(cls(first), options));
      expect(meetings.length).toBeGreaterThan(10);
      for (const d of meetings) {
        expect(weekday(d)).toBe(weekday(first));
        expect(isHoliday(d)).toBe(false);
        expect(d >= utsMonday && d <= addDays(utsMonday, 6)).toBe(false);
        expect(d < '2026-11-30').toBe(true);
      }
    }
  });
});

describe('calendar download from sulo-data', () => {
  const URL_ = 'https://ikrar06.github.io/sulo-data/calendar/latest.json';
  const deps = (body: unknown, store = memoryStore()) => {
    const fetch = fakeFetch(() => jsonResponse(body));
    const clock = fixedClock('2026-11-16', 10, 1_794_000_000);
    return { fetch, store, d: { scheduler: createScheduler({ fetch, store, clock }), store, clock, url: URL_ } };
  };

  it('keeps the bundled copy when the download is the same revision', async () => {
    const { d, store } = deps(cal);
    expect(await refreshCalendar(d)).toBe('kept');
    expect(store.dump()[CALENDAR_KEY]).toBeUndefined();
    expect((await readCalendar(store)).revisi).toBe(1);
  });

  it('takes a higher revision, and uses it from then on', async () => {
    const { d, store } = deps({ ...cal, revisi: 2 });
    expect(await refreshCalendar(d)).toBe('accepted');
    expect((await readCalendar(store)).revisi).toBe(2);
  });

  it('ignores an invalid file (data only, Zod-validated)', async () => {
    const { d, store } = deps({ ...cal, revisi: 5, kegiatan: [{ id: 'x' }] });
    expect(await refreshCalendar(d)).toBe('invalid');
    expect((await readCalendar(store)).revisi).toBe(1);
  });

  it('asks at most once a day, without cookies or headers', async () => {
    const { d, fetch, store } = deps(cal);
    await refreshCalendar(d);
    expect(fetch.calls[0]?.init).toMatchObject({ credentials: 'omit', cache: 'no-cache' });
    expect(fetch.calls[0]?.init?.headers).toBeUndefined();
    expect(store.dump()[CALENDAR_FILE_KEY]).toMatchObject({ fetchedAt: 1_794_000_000 });
    expect(await refreshCalendar(d)).toBe('not_due');
    expect(fetch.calls).toHaveLength(1);
  });

  it('a stored older revision never wins over a newer bundled copy', async () => {
    const store = memoryStore({ [CALENDAR_KEY]: { ...cal, revisi: 1, tahun_ajaran: '2025/2026' } });
    expect((await readCalendar(store)).tahun_ajaran).toBe('2026/2027');
  });
});
