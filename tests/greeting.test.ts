import { describe, expect, it } from 'vitest';
import { dayPart } from '@/lib/dashboard/greeting';

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
