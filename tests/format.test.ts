import { describe, expect, it } from 'vitest';
import { formatCopyList, type CopyItem } from '../lib/format/copy-list';
import { en } from '../lib/i18n/en';
import { calendarDaysBetween, formatAgo, formatDayDateTime, formatFullDate, formatRemaining, localDateKey } from '../lib/format/time';
import type { Task } from '../lib/types';

const TZ = 'Asia/Makassar';
const at = (y: number, mo: number, d: number, h: number, mi: number) => Date.UTC(y, mo - 1, d, h - 8, mi) / 1000; // WITA wall time
const NOW = at(2026, 11, 13, 10, 0); // Fri 13 Nov 2026, 10.00 WITA

describe('formatRemaining (docs/UI formats)', () => {
  it.each([
    [at(2026, 11, 11, 10, 0), 'terlambat 2 hari'],
    [at(2026, 11, 13, 7, 0), 'terlambat 3 jam'],
    [at(2026, 11, 13, 9, 45), 'terlambat 15 menit'],
    [at(2026, 11, 13, 10, 45), '45 menit'],
    [at(2026, 11, 13, 16, 30), '6 jam'],
    [at(2026, 11, 14, 23, 59), 'besok 23.59'],
    [at(2026, 11, 17, 12, 0), '4 hari'],
    [at(2026, 12, 12, 12, 0), '12 Des'],
  ])('%s -> %s', (due, text) => {
    expect(formatRemaining(due, NOW, TZ)).toBe(text);
  });
});

describe('time zones are applied through Intl, never a fixed offset', () => {
  it('computes local dates per zone', () => {
    const t = Date.UTC(2026, 10, 13, 17, 0) / 1000; // 01.00 WITA on the 14th, 17.00 UTC on the 13th
    expect(localDateKey(t, 'Asia/Makassar')).toBe('2026-11-14');
    expect(localDateKey(t, 'UTC')).toBe('2026-11-13');
    expect(calendarDaysBetween(NOW, t, 'Asia/Makassar')).toBe(1);
  });

  it('shows the zone abbreviation in the full date', () => {
    expect(formatFullDate(at(2026, 11, 14, 23, 59), TZ)).toMatch(/WITA|GMT\+8/);
    expect(formatDayDateTime(at(2026, 11, 14, 23, 59), TZ)).toBe('Sab, 14 Nov 23.59');
  });

  it('formats elapsed time', () => {
    expect([NOW, NOW - 300, NOW - 7200, NOW - 3 * 86_400].map((t) => formatAgo(t, NOW))).toEqual([
      'baru saja',
      '5 menit lalu',
      '2 jam lalu',
      '3 hari lalu',
    ]);
  });
});

describe('formatCopyList', () => {
  const item = (courseName: string, name: string, dueAt: number | null): CopyItem => ({
    courseName,
    task: { eventId: Math.random(), cmId: null, courseId: 1, name, module: 'assign', dueAt, url: 'https://x', overdue: false, firstSeenAt: 0, lastSeenAt: 0, missingSince: null } as Task,
  });
  const items = [
    item('NLP', 'Tugas 4 Tokenisasi', at(2026, 11, 14, 12, 0)),
    item('ASD', 'Laporan Praktikum 3', at(2026, 11, 13, 23, 59)),
    item('PBO', 'Project Akhir', at(2026, 12, 20, 23, 59)),
  ];

  it('is plain text that reads well in WhatsApp: no asterisks or Markdown', () => {
    expect(formatCopyList(items, 'week', NOW, TZ)).toBe(
      'Tugas minggu ini\n1. ASD - Laporan Praktikum 3 (Jum, 13 Nov 23.59)\n2. NLP - Tugas 4 Tokenisasi (Sab, 14 Nov 12.00)',
    );
    expect(formatCopyList(items, 'all', NOW, TZ)).not.toMatch(/[*_#`]/);
  });

  it('covers every pending task with the "all" scope', () => {
    expect(formatCopyList(items, 'all', NOW, TZ).split('\n')).toHaveLength(4);
  });

  it('never includes links', () => {
    expect(formatCopyList(items, 'all', NOW, TZ)).not.toContain('http');
  });

  it('says so when there is nothing to copy', () => {
    expect(formatCopyList([], 'week', NOW, TZ)).toBe('Tugas minggu ini: tidak ada');
  });

  it('follows the chosen language, always with the due date and time', () => {
    expect(formatCopyList(items, 'week', NOW, TZ, en)).toBe(
      "This week's tasks\n1. ASD - Laporan Praktikum 3 (Fri, 13 Nov 23:59)\n2. NLP - Tugas 4 Tokenisasi (Sat, 14 Nov 12:00)",
    );
  });
});
