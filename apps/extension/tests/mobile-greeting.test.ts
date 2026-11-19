import { describe, expect, it } from 'vitest';
import { dayOfYear, greeting, greetingState, greetSlot } from '@sulo/core/dashboard/mobile-greeting';
import { mobileWords } from '@sulo/core/i18n/mobile';
import { zonedToUnix } from '@sulo/core/reminders/zoned';

const TZ = 'Asia/Makassar';
const at = (day: string, hh: number, mm = 0) => zonedToUnix(day, hh * 60 + mm, TZ);
const id = mobileWords('id');
const en = mobileWords('en');
const calm = { nickname: '', overdue: 0, dueToday: 0, timeZone: TZ };

describe("the Android app's greeting: slots by local hour", () => {
  it.each([
    [3, 59, 'tengahMalam'],
    [4, 0, 'pagi'],
    [10, 59, 'pagi'],
    [11, 0, 'siang'],
    [14, 59, 'siang'],
    [15, 0, 'sore'],
    [17, 59, 'sore'],
    [18, 0, 'malam'],
    [23, 59, 'malam'],
    [0, 0, 'tengahMalam'],
  ])('%i.%i is %s', (hh, mm, slot) => {
    expect(greetSlot(hh)).toBe(slot);
    expect(greeting({ ...calm, now: at('2026-11-18', hh, mm) }, id).slot).toBe(slot);
  });

  it('line 1 in both languages; "Good night" is never a greeting', () => {
    const line1 = (w: typeof id, hh: number) => greeting({ ...calm, now: at('2026-11-18', hh) }, w).line1;
    expect([4, 11, 15, 18, 0].map((h) => line1(id, h))).toEqual(['Selamat pagi,', 'Selamat siang,', 'Selamat sore,', 'Selamat malam,', 'Selamat malam,']);
    expect([4, 11, 15, 18, 0].map((h) => line1(en, h))).toEqual(['Good morning,', 'Good afternoon,', 'Good afternoon,', 'Good evening,', 'Good evening,']);
    for (const w of [id, en]) for (const h of Array.from({ length: 24 }, (_, i) => i)) expect(line1(w, h).toLowerCase()).not.toContain('night');
  });
});

describe('line 2: the day\'s phrase, or the nickname', () => {
  it('the same phrase all day in a slot, another the next day (day of the year)', () => {
    const p = (day: string, hh: number) => greeting({ ...calm, now: at(day, hh) }, id).line2;
    expect(p('2026-11-18', 7)).toBe(p('2026-11-18', 10));
    expect(dayOfYear('2026-01-01')).toBe(1);
    expect(dayOfYear('2026-11-18')).toBe(322);
    // 322 mod 3 = 1: the second of the morning's three.
    expect(p('2026-11-18', 7)).toBe('yuk, mulai harimu.');
    expect(p('2026-11-19', 7)).toBe('semoga harimu lancar.');
    expect(p('2026-11-20', 7)).toBe('semangat hari ini!');
  });

  it('casual phrases only when nothing is overdue and nothing is due today', () => {
    const casual = new Set(['pelan-pelan saja.', 'waktunya istirahat.', 'hari ini cukup, kok.', 'take it easy.', 'time to wind down.']);
    for (let d = 1; d <= 30; d++) {
      const day = `2026-11-${String(d).padStart(2, '0')}`;
      for (const hh of [12, 20])
        for (const w of [id, en])
          for (const busy of [{ overdue: 2, dueToday: 0 }, { overdue: 0, dueToday: 1 }]) expect(casual.has(greeting({ ...calm, ...busy, now: at(day, hh) }, w).line2)).toBe(false);
    }
    // With nothing pressing, a casual one does come up on some day.
    const seen = new Set(Array.from({ length: 6 }, (_, i) => greeting({ ...calm, now: at(`2026-11-${10 + i}`, 20) }, id).line2));
    expect([...seen].some((p) => casual.has(p))).toBe(true);
  });

  it('a nickname takes line 2 with a full stop; the phrase is kept for the state line', () => {
    const g = greeting({ ...calm, nickname: ' Ikrar ', now: at('2026-11-18', 7) }, id);
    expect(g.line2).toBe('Ikrar.');
    expect(g.phrase).toBe('yuk, mulai harimu.');
    expect(g.line2Small).toBe(false);
  });

  it('long phrases are set smaller', () => {
    expect(greeting({ ...calm, now: at('2026-11-19', 7) }, id)).toMatchObject({ line2: 'semoga harimu lancar.', line2Small: true });
    const long = Object.values(en.greet.phrases).flat().find((p) => p.text === "that's enough for today.");
    expect(long).toMatchObject({ casual: true, small: true });
  });
});

describe('the state line under the greeting', () => {
  const base = { sessionExpired: false, overdue: 0, dueToday: 0, dueTomorrow: 0, nickname: '', phrase: 'yuk, mulai harimu.' };
  it('first match wins: session, overdue, today, tomorrow, all clear', () => {
    expect(greetingState({ ...base, sessionExpired: true, overdue: 3 }, id).text).toBe('Masuk lagi untuk memperbarui');
    expect(greetingState({ ...base, overdue: 3, dueToday: 2 }, id)).toEqual({ count: '3', text: ' tugas terlambat' });
    expect(greetingState({ ...base, dueToday: 2, dueTomorrow: 1 }, id).text).toBe('2 tenggat hari ini');
    expect(greetingState({ ...base, dueTomorrow: 1 }, id).text).toBe('1 tenggat besok');
    expect(greetingState(base, id).text).toBe('Semua aman hari ini');
  });
  it('English singular and plural', () => {
    expect(greetingState({ ...base, overdue: 1 }, en)).toEqual({ count: '1', text: ' overdue task' });
    expect(greetingState({ ...base, overdue: 4 }, en)).toEqual({ count: '4', text: ' overdue tasks' });
    expect(greetingState({ ...base, dueToday: 1 }, en).text).toBe('1 due today');
    expect(greetingState(base, en).text).toBe('All clear today');
    expect(greetingState({ ...base, sessionExpired: true }, en).text).toBe('Sign in again to update');
  });
  it('with a nickname, the phrase replaces "all clear" only; numbers stay when something is due', () => {
    expect(greetingState({ ...base, nickname: 'Ikrar' }, id).text).toBe('Yuk, mulai harimu.');
    expect(greetingState({ ...base, nickname: 'Ikrar', dueTomorrow: 2 }, id).text).toBe('2 tenggat besok');
  });
});
