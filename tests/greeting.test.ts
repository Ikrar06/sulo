import { describe, expect, it } from 'vitest';
import { dayPart, greetingText } from '@/lib/dashboard/greeting';
import { dashFor } from '@/lib/i18n/dashboard';
import { normalizeNickname, NICKNAME_MAX } from '@/lib/prefs';

describe('greetingText', () => {
  it('adds the nickname after a comma when one is set, in every time slot and both languages', () => {
    for (const locale of ['id', 'en'] as const) {
      const g = dashFor(locale).ringkasan.greeting;
      for (const part of ['pagi', 'siang', 'sore', 'malam'] as const) expect(greetingText(g[part], 'Ikrar')).toBe(`${g[part]}, Ikrar`);
    }
    expect(greetingText('Selamat pagi', 'Ikrar')).toBe('Selamat pagi, Ikrar');
    expect(greetingText('Good evening', 'Ikrar')).toBe('Good evening, Ikrar');
  });

  it('is the plain greeting when the nickname is empty or only spaces', () => {
    expect(greetingText('Selamat pagi', '')).toBe('Selamat pagi');
    expect(greetingText('Selamat malam', '   ')).toBe('Selamat malam');
    expect(greetingText('Good morning', '')).toBe('Good morning');
  });
});

describe('normalizeNickname', () => {
  it('trims and keeps at most 24 characters', () => {
    expect(NICKNAME_MAX).toBe(24);
    expect(normalizeNickname('  Ikrar  ')).toBe('Ikrar');
    expect(normalizeNickname('a'.repeat(30))).toBe('a'.repeat(24));
    expect(normalizeNickname(`${'b'.repeat(23)} c`)).toBe('b'.repeat(23));
    expect(Array.from(normalizeNickname('🔥'.repeat(30)))).toHaveLength(24);
  });
});

describe('dayPart', () => {
  it('follows the agreed hour bands, edges included', () => {
    const expected: Record<number, string> = {
      0: 'malam',
      3: 'malam',
      4: 'pagi',
      10: 'pagi',
      11: 'siang',
      14: 'siang',
      15: 'sore',
      17: 'sore',
      18: 'malam',
      23: 'malam',
    };
    for (const [hour, part] of Object.entries(expected)) expect(dayPart(Number(hour)), `hour ${hour}`).toBe(part);
  });

  it('covers every hour of the day', () => {
    const parts = new Set(Array.from({ length: 24 }, (_, h) => dayPart(h)));
    expect([...parts].sort()).toEqual(['malam', 'pagi', 'siang', 'sore']);
  });
});
