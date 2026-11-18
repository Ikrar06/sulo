// Layout of the Jadwal page's time grid (M7.1). Pure.

import type { ClassMeeting } from './view';

export const SLOT_MIN = 30;
/** One hour of the grid, in pixels. */
export const HOUR_PX = 48;
/** The grid spans at least this many minutes. */
export const MIN_SPAN = 4 * 60;
/** Up to this many minutes the grid fits without scrolling at 1440x900. */
export const NO_SCROLL_SPAN = 10 * 60;

export const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * The grid's hours: from the full hour before the earliest start, minus an
 * hour, to the full hour after the latest end, plus an hour; at least 4
 * hours in all. Without classes: 07.00 to 11.00 (never shown, the page has
 * an empty state).
 */
export function gridRange(meetings: readonly Pick<ClassMeeting, 'start' | 'end'>[]): { start: number; end: number } {
  if (meetings.length === 0) return { start: 7 * 60, end: 7 * 60 + MIN_SPAN };
  const start = Math.max(0, Math.floor(Math.min(...meetings.map((m) => toMinutes(m.start))) / 60) * 60 - 60);
  const end = Math.min(24 * 60, Math.ceil(Math.max(...meetings.map((m) => toMinutes(m.end))) / 60) * 60 + 60);
  return end - start >= MIN_SPAN ? { start, end } : { start, end: Math.min(24 * 60, start + MIN_SPAN) };
}

/** A block's place in pixels, exact to the minute (07.50 starts at 07.50, not 08.00). */
export function blockBox(m: Pick<ClassMeeting, 'start' | 'end'>, rangeStart: number, hourPx = HOUR_PX): { top: number; height: number } {
  const perMin = hourPx / 60;
  return { top: (toMinutes(m.start) - rangeStart) * perMin, height: (toMinutes(m.end) - toMinutes(m.start)) * perMin };
}

/**
 * What a block shows for its length: 60 minutes or more, name (2 lines),
 * time and room; 40 to 59, name and "time · room"; under 40, one line.
 */
export function blockLayout(m: Pick<ClassMeeting, 'start' | 'end'>): 'tall' | 'medium' | 'short' {
  const minutes = toMinutes(m.end) - toMinutes(m.start);
  return minutes >= 60 ? 'tall' : minutes >= 40 ? 'medium' : 'short';
}

/** Days shown: Monday to Saturday, and Sunday only when a class meets on it (0 = Sunday). */
export function gridDays(meetings: readonly Pick<ClassMeeting, 'weekday'>[]): number[] {
  return meetings.some((m) => m.weekday === 0) ? [1, 2, 3, 4, 5, 6, 0] : [1, 2, 3, 4, 5, 6];
}

/** Side-by-side lanes for classes that overlap on one day: lane index and how many lanes share the time. */
export function lanes<M extends Pick<ClassMeeting, 'start' | 'end'>>(dayMeetings: readonly M[]): { meeting: M; lane: number; lanes: number }[] {
  const sorted = [...dayMeetings].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  const out: { meeting: M; lane: number; lanes: number }[] = [];
  let cluster: { meeting: M; lane: number; lanes: number }[] = [];
  let clusterEnd = -1;
  const close = () => {
    const n = Math.max(1, ...cluster.map((c) => c.lane + 1));
    cluster.forEach((c) => out.push({ ...c, lanes: n }));
    cluster = [];
  };
  for (const meeting of sorted) {
    const start = toMinutes(meeting.start);
    if (cluster.length > 0 && start >= clusterEnd) close();
    const busy = new Set(cluster.filter((c) => toMinutes(c.meeting.end) > start).map((c) => c.lane));
    let lane = 0;
    while (busy.has(lane)) lane += 1;
    cluster.push({ meeting, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, toMinutes(meeting.end));
  }
  close();
  return out;
}
