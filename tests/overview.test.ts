import { describe, expect, it } from 'vitest';
import { buildSummary, groupOverview, heroMood, limitGroups, withNext } from '@/lib/dashboard/overview';
import { zonedToUnix } from '@/lib/reminders/zoned';

const TZ = 'Asia/Makassar';
// Monday 16 Nov 2026, 15.00 local.
const NOW = zonedToUnix('2026-11-16', 15 * 60, TZ);
const at = (day: string, hour: number) => ({ dueAt: zonedToUnix(day, hour * 60, TZ) });

describe('groupOverview', () => {
  it('splits by local day: overdue, today, tomorrow, the rest of 7 days; leaves out empty groups and undated tasks', () => {
    const items = [at('2026-11-16', 10), at('2026-11-16', 23), at('2026-11-17', 8), at('2026-11-20', 12), at('2026-11-23', 23), at('2026-11-24', 1), { dueAt: null }];
    const groups = groupOverview(items, NOW, TZ);
    expect(groups.map((g) => [g.key, g.rows.length])).toEqual([
      ['overdue', 1],
      ['today', 1],
      ['tomorrow', 1],
      ['week', 2],
    ]);
  });

  it('a due time earlier today is overdue, not today', () => {
    expect(groupOverview([at('2026-11-16', 14)], NOW, TZ).map((g) => g.key)).toEqual(['overdue']);
  });

  it('sorts rows by due time inside a group', () => {
    const [week] = groupOverview([at('2026-11-21', 9), at('2026-11-19', 9)], NOW, TZ);
    expect(week!.rows.map((r) => r.dueAt)).toEqual([at('2026-11-19', 9).dueAt, at('2026-11-21', 9).dueAt]);
  });

  it('is empty when nothing is due within 7 days', () => {
    expect(groupOverview([at('2026-12-01', 9)], NOW, TZ)).toEqual([]);
  });
});

describe('limitGroups', () => {
  const g = (key: 'overdue' | 'today' | 'week', n: number) => ({ key, rows: Array.from({ length: n }, (_, i) => i) });
  it('keeps at most 6 rows in group order and counts the rest', () => {
    const { groups, hidden } = limitGroups([g('overdue', 2), g('today', 3), g('week', 4)]);
    expect(groups.map((x) => [x.key, x.rows.length])).toEqual([
      ['overdue', 2],
      ['today', 3],
      ['week', 1],
    ]);
    expect(hidden).toBe(3);
  });
  it('drops a group that has no room left', () => {
    const { groups, hidden } = limitGroups([g('overdue', 6), g('week', 2)]);
    expect(groups.map((x) => x.key)).toEqual(['overdue']);
    expect(hidden).toBe(2);
  });
});

describe('heroMood', () => {
  it('uses only existing expressions', () => {
    expect(heroMood(1, 4)).toBe('urgent');
    expect(heroMood(0, 0)).toBe('all-done');
    expect(heroMood(0, 3)).toBe('idle');
  });
});

describe('buildSummary', () => {
  const next = { label: 'UAS', countdown: { kind: 'days' as const, n: 14 } };
  it('overdue, this week, then the next important date; parts at 0 are left out', () => {
    expect(buildSummary({ overdue: 1, dueThisWeek: 0, next })).toEqual([
      { kind: 'overdue', n: 1 },
      { kind: 'countdown', label: 'UAS', countdown: { kind: 'days', n: 14 } },
    ]);
    expect(buildSummary({ overdue: 0, dueThisWeek: 3, next: null })).toEqual([{ kind: 'week', n: 3 }]);
  });
  it('both counts at 0: "Tidak ada tenggat minggu ini"', () => {
    expect(buildSummary({ overdue: 0, dueThisWeek: 0, next: null })).toEqual([{ kind: 'none' }]);
    expect(buildSummary({ overdue: 0, dueThisWeek: 0, next })[0]).toEqual({ kind: 'none' });
  });
  it('without a next date there is no countdown part', () => {
    expect(buildSummary({ overdue: 2, dueThisWeek: 5, next: null }).map((p) => p.kind)).toEqual(['overdue', 'week']);
  });
});

describe('withNext', () => {
  it('fewer than 4 rows: the nearest tasks after this week fill up to 4, as "next"', () => {
    const items = [at('2026-11-16', 23), at('2026-11-30', 9), at('2026-12-02', 9), at('2026-12-20', 9), at('2026-12-21', 9)];
    const groups = withNext(groupOverview(items, NOW, TZ), items, NOW, TZ);
    expect(groups.map((g) => [g.key, g.rows.length])).toEqual([
      ['today', 1],
      ['next', 3],
    ]);
    expect(groups[1]!.rows[0]).toEqual(at('2026-11-30', 9));
  });
  it('4 rows or more: nothing added; nothing later: nothing added', () => {
    const four = [at('2026-11-17', 9), at('2026-11-18', 9), at('2026-11-19', 9), at('2026-11-20', 9), at('2026-12-01', 9)];
    expect(withNext(groupOverview(four, NOW, TZ), four, NOW, TZ).map((g) => g.key)).not.toContain('next');
    expect(withNext([], [], NOW, TZ)).toEqual([]);
  });
});
