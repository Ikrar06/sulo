// Month grid layout, one Monday-to-Sunday week at a time. Pure.
//
// Multi-day events become one bar per week: clipped to the week, placed with
// grid-column start/span, rounded only where the event really starts or
// ends. Lanes are filled greedily, ordered by start, then longest first.
// Status periods (semester breaks, KKN, admissions) are not bars: they tint
// the cells and label the first cell of each week's segment.

import { addDays, daysBetween } from './dates.ts';
import type { CalEvent } from './groups.ts';

export const MAX_LANES = 3;

export interface WeekBar {
  event: CalEvent;
  /** 0 = Monday .. 6 = Sunday. */
  startCol: number;
  span: number;
  lane: number;
  /** The event started before this week (left end square). */
  continuesBefore: boolean;
  /** The event goes on after this week (right end square). */
  continuesAfter: boolean;
}

export interface WeekPeriod {
  event: CalEvent;
  startCol: number;
  span: number;
}

export interface WeekLayout {
  bars: WeekBar[];
  /** Events per day that did not fit in the lanes ("+n lagi"). */
  hidden: number[];
  /** Status periods clipped to the week; the cells they cover get a tint. */
  periods: WeekPeriod[];
}

const clip = (e: CalEvent, weekStart: string) => {
  const weekEnd = addDays(weekStart, 6);
  if (e.end < weekStart || e.start > weekEnd) return null;
  const from = e.start < weekStart ? weekStart : e.start;
  const to = e.end > weekEnd ? weekEnd : e.end;
  return { startCol: daysBetween(weekStart, from), span: daysBetween(from, to) + 1, continuesBefore: e.start < weekStart, continuesAfter: e.end > weekEnd };
};

export function layoutWeek(events: readonly CalEvent[], weekStart: string, maxLanes = MAX_LANES): WeekLayout {
  const periods: WeekPeriod[] = [];
  const segments: Omit<WeekBar, 'lane'>[] = [];
  for (const event of events) {
    const c = clip(event, weekStart);
    if (!c) continue;
    if (event.period) periods.push({ event, startCol: c.startCol, span: c.span });
    else segments.push({ event, ...c });
  }
  // Start first, then the longest (whole event, so a long event keeps its lane across weeks), then a stable id.
  const length = (e: CalEvent) => daysBetween(e.start, e.end);
  segments.sort((a, b) => a.startCol - b.startCol || length(b.event) - length(a.event) || a.event.id.localeCompare(b.event.id));

  const laneEnds: number[] = [];
  const bars: WeekBar[] = [];
  const hidden = Array.from({ length: 7 }, () => 0);
  for (const s of segments) {
    let lane = laneEnds.findIndex((end) => end < s.startCol);
    if (lane === -1) lane = laneEnds.length;
    if (lane >= maxLanes) {
      for (let col = s.startCol; col < s.startCol + s.span; col++) hidden[col]! += 1;
      continue;
    }
    laneEnds[lane] = s.startCol + s.span - 1;
    bars.push({ ...s, lane });
  }
  periods.sort((a, b) => a.startCol - b.startCol || a.event.id.localeCompare(b.event.id));
  return { bars, hidden, periods };
}

/** The period that tints a day column, if any (the first one wins when they overlap). */
export function periodAt(layout: WeekLayout, col: number): WeekPeriod | null {
  return layout.periods.find((p) => col >= p.startCol && col < p.startCol + p.span) ?? null;
}
