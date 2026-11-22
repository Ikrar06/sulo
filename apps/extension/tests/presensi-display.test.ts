import { describe, expect, it } from 'vitest';
import { remarkText, sessionTimeText } from '@sulo/core/presensi/display';
import { parseTimeRange, statusOf } from '@sulo/core/presensi/parse';
import { formatMinuteRange } from '@sulo/core/format/time';

describe('session times from SIKOLA in Sulo format', () => {
  it.each([
    ['10:20AM - 12PM', '10.20–12.00', '10:20 AM–12:00 PM'],
    ['7:50AM - 10:20AM', '07.50–10.20', '7:50 AM–10:20 AM'],
    ['1PM - 2:40PM', '13.00–14.40', '1:00 PM–2:40 PM'],
    ['10:20 AM – 12:00 PM', '10.20–12.00', '10:20 AM–12:00 PM'],
    ['11:30am-1pm', '11.30–13.00', '11:30 AM–1:00 PM'],
    ['07.30 - 10.00', '07.30–10.00', '7:30 AM–10:00 AM'],
    ['13:00-15:30', '13.00–15.30', '1:00 PM–3:30 PM'],
    ['10:20 - 12PM', '10.20–12.00', '10:20 AM–12:00 PM'],
    ['12PM - 1:40PM', '12.00–13.40', '12:00 PM–1:40 PM'],
  ])('%s', (raw, id, en) => {
    expect(sessionTimeText(raw, 'id')).toBe(id);
    expect(sessionTimeText(raw, 'en')).toBe(en);
  });

  it.each(['', 'All day', '10AM', '25:00 - 26:00', '3PM - 1PM', '10:20AM - 12PM - 1PM', '13PM - 14PM'])('not a range, shown as written: %j', (raw) => {
    expect(parseTimeRange(raw)).toBeNull();
    expect(sessionTimeText(raw, 'id')).toBe(raw);
  });

  it('the formatter alone', () => {
    expect(formatMinuteRange(0, 59, 'id')).toBe('00.00–00.59');
    expect(formatMinuteRange(0, 59, 'en')).toBe('12:00 AM–12:59 AM');
  });
});

describe('statuses and remarks in the glossary', () => {
  it('SIKOLA status words map to Hadir, Terlambat, Izin, Alpa; others stay unknown', () => {
    expect(['Present', 'Late', 'Excused', 'Absent', 'Hadir', 'Terlambat', 'Izin', 'Alpa', 'Sakit', 'Anwesend'].map(statusOf)).toEqual(['present', 'late', 'excused', 'absent', 'present', 'late', 'excused', 'absent', 'excused', 'unknown']);
  });

  it('"Self-recorded" reads "Dicatat sendiri" in id; a teacher\'s note stays as written', () => {
    expect(remarkText('Self-recorded', 'id')).toBe('Dicatat sendiri');
    expect(remarkText('Self recorded', 'id')).toBe('Dicatat sendiri');
    expect(remarkText('Self-recorded', 'en')).toBe('Self-recorded');
    expect(remarkText('Catatan sintetis', 'id')).toBe('Catatan sintetis');
  });
});

describe('Studi card lines from the recap page fixture', async () => {
  const { readFileSync } = await import('node:fs');
  const { parseRecap } = await import('@sulo/core/presensi/parse');
  const { averagePercent, lowestBelowAverage } = await import('@sulo/core/presensi/service');
  const parsed = parseRecap(readFileSync(new URL('../fixtures/synthetic/pages/attendance-all-courses.html', import.meta.url), 'utf8'));
  it('gives an average, and a lowest course only when one is below it', () => {
    if (parsed.kind !== 'ok') throw new Error('shape');
    const avg = averagePercent(parsed.value);
    const low = lowestBelowAverage(parsed.value);
    expect(avg).not.toBeNull();
    const below = parsed.value.filter((r) => r.taken > 0 && r.percent !== null && r.percent < avg!);
    expect(low === null).toBe(below.length === 0);
    if (low) expect(low.percent).toBe(Math.min(...below.map((r) => r.percent!)));
  });
});

describe('the one line after a fetch (presensiNote)', async () => {
  const { presensiNote } = await import('@sulo/ui/dashboard/PresensiParts');
  const { dashFor } = await import('@sulo/core/i18n/dashboard');
  const w = dashFor('id').presensi;
  it('fresh or ok: nothing; no answer or a failure: never silent', () => {
    expect(presensiNote({ status: 'ok' }, 'recap', true, true, w)).toBe('');
    expect(presensiNote({ status: 'fresh' }, 'recap', false, true, w)).toBe('');
    expect(presensiNote(null, 'recap', true, false, w)).toBe(w.failed);
    expect(presensiNote({ status: 'failed', reason: 'x' }, 'detail', false, false, w)).toBe(w.failed);
    expect(presensiNote({ status: 'user_unverified' }, 'recap', true, true, w)).toBe(w.failed);
  });
  it('the cooldown line only for Perbarui pressed again with data on screen', () => {
    const cooldown = { status: 'cooldown' as const, retryAt: 0 };
    expect(presensiNote(cooldown, 'recap', true, true, w)).toBe(w.cooldown);
    expect(presensiNote(cooldown, 'recap', true, false, w)).toBe('');
    expect(presensiNote(cooldown, 'detail', false, true, w)).toBe('');
  });
  it('a changed page and no attendance activity', () => {
    expect(presensiNote({ status: 'unknown_shape' }, 'detail', false, false, w)).toBe(w.unknownShape);
    expect(presensiNote({ status: 'no_attendance' }, 'recap', false, false, w)).toBe(w.noAttendanceYet);
    expect(presensiNote({ status: 'no_attendance' }, 'detail', false, false, w)).toBe('');
  });
});
