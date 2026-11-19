import { describe, expect, it } from 'vitest';
import { barHeight, dotOf, WEEK_BAR_MAX, WEEK_BAR_MIN, weekBars } from '@sulo/core/dashboard/week-bars';
import type { Task } from '@sulo/core/types';

const NOW = Date.UTC(2026, 10, 16, 2, 0) / 1000; // Mon 16 Nov 2026, 10.00 WITA
const TZ = 'Asia/Makassar';
const H = 3600;
const task = (eventId: number, dueAt: number): Task => ({
  eventId,
  cmId: null,
  courseId: 1,
  name: `Tugas ${eventId}`,
  module: 'assign',
  dueAt,
  url: `https://sikola-v2.unhas.ac.id/mod/assign/view.php?id=${eventId}`,
  overdue: false,
  firstSeenAt: NOW,
  lastSeenAt: NOW,
  missingSince: null,
});
const ev = (id: string, kategori: 'uts' | 'krs' | 'libur', mulai: string, selesai: string | null = null) => ({ id, judul: id, kategori, mulai, selesai, perkiraan: false, audiens: 'mahasiswa' as const });

describe('7-day bars (mobile Ringkasan)', () => {
  it('seven local days from today, today flagged', () => {
    const bars = weekBars([], [], NOW, TZ);
    expect(bars).toHaveLength(7);
    expect(bars[0]).toMatchObject({ dateKey: '2026-11-16', isToday: true });
    expect(bars[6]?.dateKey).toBe('2026-11-22');
    expect(bars.slice(1).every((b) => !b.isToday)).toBe(true);
  });
  it('scales to the busiest day with a baseline for empty days', () => {
    const tasks = [task(1, NOW + 2 * H), task(2, NOW + 3 * H), task(3, NOW + 4 * H), task(4, NOW + 4 * H), task(5, NOW + 26 * H)];
    const bars = weekBars(tasks, [], NOW, TZ);
    expect(bars[0]).toMatchObject({ count: 4, height: WEEK_BAR_MAX });
    expect(bars[1]).toMatchObject({ count: 1, height: 12 });
    expect(bars[2]).toMatchObject({ count: 0, height: WEEK_BAR_MIN });
  });
  it('heights stay within bounds', () => {
    expect(barHeight(0, 0)).toBe(WEEK_BAR_MIN);
    expect(barHeight(1, 40)).toBe(WEEK_BAR_MIN);
    expect(barHeight(3, 3)).toBe(WEEK_BAR_MAX);
  });
  it('dots exams always, other events on their edges, never long periods', () => {
    expect(dotOf([ev('a', 'uts', '2026-11-10', '2026-11-20')], '2026-11-16')).toBe('ujian');
    expect(dotOf([ev('b', 'krs', '2026-11-16', '2026-11-30')], '2026-11-16')).toBe('administrasi');
    expect(dotOf([ev('b', 'krs', '2026-11-10', '2026-11-30')], '2026-11-16')).toBeNull();
    expect(dotOf([ev('c', 'libur', '2026-11-16')], '2026-11-16')).toBeNull();
  });
  it('passes calendar events through to the dot', () => {
    const bars = weekBars([], [ev('k', 'krs', '2026-11-18', '2026-11-25')], NOW, TZ);
    expect(bars[2]?.dot).toBe('administrasi');
    expect(bars[3]?.dot).toBeNull();
  });
});
