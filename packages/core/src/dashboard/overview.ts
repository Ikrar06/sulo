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
 * The whole task list in the same groups (the Android app's Tugas screen):
 * overdue, today, tomorrow, this week, then "next" with every later task,
 * the dated ones by due date and the undated ones last. Nothing is dropped.
 */
export function groupTaskList<T extends { dueAt: UnixSeconds | null }>(items: readonly T[], now: UnixSeconds, timeZone: string): OverviewGroup<T>[] {
  const groups = groupOverview(items, now, timeZone);
  const placed = new Set<T>(groups.flatMap((g) => g.rows));
  const rest = items.filter((i) => !placed.has(i)).sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity));
  return rest.length > 0 ? [...groups, { key: 'next', rows: rest }] : groups;
}

/** With other groups to show, overdue rows take at most this many of the card's rows. */
export const OVERDUE_MAX_ROWS = 3;

/**
 * "Berikutnya": when fewer than OVERVIEW_MIN_ROWS upcoming rows (today,
 * tomorrow, this week) are shown, the nearest tasks after this week fill up
 * to that many, then tasks without a due date. Overdue rows do not count:
 * a long overdue list must not hide what comes next (M7.1 fix).
 */
export function withNext<T extends { dueAt: UnixSeconds | null }>(groups: readonly OverviewGroup<T>[], items: readonly T[], now: UnixSeconds, timeZone: string, min = OVERVIEW_MIN_ROWS): OverviewGroup<T>[] {
  const upcoming = groups.filter((g) => g.key !== 'overdue').reduce((n, g) => n + g.rows.length, 0);
  if (upcoming >= min) return [...groups];
  const weekEnd = addDays(localParts(now, timeZone).dateKey, WEEK_DAYS);
  const later = items
    .filter((i) => i.dueAt !== null && i.dueAt >= now && localParts(i.dueAt, timeZone).dateKey > weekEnd)
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));
  const undated = items.filter((i) => i.dueAt === null);
  const next = [...later, ...undated].slice(0, min - upcoming);
  return next.length > 0 ? [...groups, { key: 'next', rows: next }] : [...groups];
}

/**
 * At most `max` rows across the groups, in order; `hidden` counts the rest.
 * When other groups follow, overdue rows take at most OVERDUE_MAX_ROWS so
 * today, this week and "Berikutnya" stay visible.
 */
export function limitGroups<T>(groups: readonly OverviewGroup<T>[], max = OVERVIEW_ROWS): { groups: OverviewGroup<T>[]; hidden: number } {
  let room = max;
  let hidden = 0;
  const shown: OverviewGroup<T>[] = [];
  const others = groups.some((g) => g.key !== 'overdue');
  for (const g of groups) {
    const cap = g.key === 'overdue' && others ? Math.min(room, OVERDUE_MAX_ROWS) : room;
    const take = g.rows.slice(0, Math.max(0, cap));
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

export type SummaryPart = { kind: 'overdue'; n: number } | { kind: 'week'; n: number } | { kind: 'none' } | { kind: 'classes'; n: number } | { kind: 'countdown'; label: string; countdown: SummaryCountdown };

export interface SummaryInput {
  overdue: number;
  /** Tasks due from now to the end of "Minggu ini" (today, tomorrow and the week). */
  dueThisWeek: number;
  /** The next important calendar date, if any. */
  next: { label: string; countdown: SummaryCountdown } | null;
  /** Classes still to come today (NEOSIA schedule); 0 or absent leaves the part out. */
  classesToday?: number;
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
  if (input.classesToday) parts.push({ kind: 'classes', n: input.classesToday });
  if (input.next) parts.push({ kind: 'countdown', label: input.next.label, countdown: input.next.countdown });
  return parts;
}
