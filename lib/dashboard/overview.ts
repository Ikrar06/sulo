// The overview (Ringkasan): one task list grouped by day, the hero's
// mascot mood and its one-line summary. Pure; dates are local day keys in
// the browser's time zone.

import type { MascotState } from '../view/popup-view';
import { addDays, localParts } from '../reminders/zoned';
import type { UnixSeconds } from '../types';

export type OverviewGroupKey = 'overdue' | 'today' | 'tomorrow' | 'week' | 'next';
export const OVERVIEW_GROUPS: readonly OverviewGroupKey[] = ['overdue', 'today', 'tomorrow', 'week'];

/** "Minggu ini": due after tomorrow, up to 7 days from today. */
export const WEEK_DAYS = 7;
/** Rows shown in the overview's task card; the rest is "+n lainnya". */
export const OVERVIEW_ROWS = 6;
/** With fewer rows than this, "Berikutnya" fills in with the nearest tasks after this week. */
export const OVERVIEW_MIN_ROWS = 4;

export interface OverviewGroup<T> {
  key: OverviewGroupKey;
  rows: T[];
}

/** Overdue, today, tomorrow and the rest of the week; empty groups are left out, undated tasks too. */
export function groupOverview<T extends { dueAt: UnixSeconds | null }>(items: readonly T[], now: UnixSeconds, timeZone: string): OverviewGroup<T>[] {
  const today = localParts(now, timeZone).dateKey;
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, WEEK_DAYS);
  const buckets: Record<OverviewGroupKey, T[]> = { overdue: [], today: [], tomorrow: [], week: [], next: [] };
  for (const item of items) {
    if (item.dueAt === null) continue;
    if (item.dueAt < now) {
      buckets.overdue.push(item);
      continue;
    }
    const day = localParts(item.dueAt, timeZone).dateKey;
    if (day === today) buckets.today.push(item);
    else if (day === tomorrow) buckets.tomorrow.push(item);
    else if (day <= weekEnd) buckets.week.push(item);
  }
  return OVERVIEW_GROUPS.map((key) => ({ key, rows: [...buckets[key]].sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0)) })).filter((g) => g.rows.length > 0);
}

/**
 * When the groups hold fewer than OVERVIEW_MIN_ROWS rows, a "next" group
 * adds the nearest dated tasks after this week, up to that many rows in all.
 */
export function withNext<T extends { dueAt: UnixSeconds | null }>(groups: readonly OverviewGroup<T>[], items: readonly T[], now: UnixSeconds, timeZone: string, min = OVERVIEW_MIN_ROWS): OverviewGroup<T>[] {
  const shown = groups.reduce((n, g) => n + g.rows.length, 0);
  if (shown >= min) return [...groups];
  const weekEnd = addDays(localParts(now, timeZone).dateKey, WEEK_DAYS);
  const later = items
    .filter((i) => i.dueAt !== null && i.dueAt >= now && localParts(i.dueAt, timeZone).dateKey > weekEnd)
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))
    .slice(0, min - shown);
  return later.length > 0 ? [...groups, { key: 'next', rows: later }] : [...groups];
}

/** At most `max` rows across the groups, in order; `hidden` counts the rest. */
export function limitGroups<T>(groups: readonly OverviewGroup<T>[], max = OVERVIEW_ROWS): { groups: OverviewGroup<T>[]; hidden: number } {
  let room = max;
  let hidden = 0;
  const shown: OverviewGroup<T>[] = [];
  for (const g of groups) {
    const take = g.rows.slice(0, Math.max(0, room));
    hidden += g.rows.length - take.length;
    room -= take.length;
    if (take.length > 0) shown.push({ key: g.key, rows: take });
  }
  return { groups: shown, hidden };
}

/** Existing expressions only: worried when something is late, happy with nothing due this week. */
export function heroMood(overdue: number, dueThisWeek: number): MascotState {
  if (overdue > 0) return 'urgent';
  if (dueThisWeek === 0) return 'all-done';
  return 'idle';
}

export type SummaryCountdown = { kind: 'days'; n: number } | { kind: 'today' } | { kind: 'tomorrow' } | { kind: 'ongoing' };

export type SummaryPart = { kind: 'overdue'; n: number } | { kind: 'week'; n: number } | { kind: 'none' } | { kind: 'countdown'; label: string; countdown: SummaryCountdown };

export interface SummaryInput {
  overdue: number;
  /** Tasks due from now to the end of "Minggu ini" (today, tomorrow and the week). */
  dueThisWeek: number;
  /** The next important calendar date, if any. */
  next: { label: string; countdown: SummaryCountdown } | null;
}

/**
 * "1 tugas terlambat · 3 tenggat minggu ini · UAS mulai 14 hari lagi".
 * Parts at 0 are left out; when both counts are 0 the line says "Tidak ada
 * tenggat minggu ini" instead.
 */
export function buildSummary(input: SummaryInput): SummaryPart[] {
  const parts: SummaryPart[] = [];
  if (input.overdue > 0) parts.push({ kind: 'overdue', n: input.overdue });
  if (input.dueThisWeek > 0) parts.push({ kind: 'week', n: input.dueThisWeek });
  if (parts.length === 0) parts.push({ kind: 'none' });
  if (input.next) parts.push({ kind: 'countdown', label: input.next.label, countdown: input.next.countdown });
  return parts;
}
