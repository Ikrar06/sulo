// Layout of the Jadwal page's time grid (M7.1). Pure.

import type { ClassMeeting } from './view';

export const SLOT_MIN = 30;
const DEFAULT_START = 7 * 60;
const DEFAULT_END = 17 * 60;

export const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * The grid's hours: an hour before the earliest start to an hour after the
 * latest end, on whole hours, never narrower than 07.00 to 17.00.
 */
export function gridRange(meetings: readonly Pick<ClassMeeting, 'start' | 'end'>[]): { start: number; end: number } {
  if (meetings.length === 0) return { start: DEFAULT_START, end: DEFAULT_END };
  const first = Math.min(...meetings.map((m) => toMinutes(m.start))) - 60;
  const last = Math.max(...meetings.map((m) => toMinutes(m.end))) + 60;
  return { start: Math.max(0, Math.min(DEFAULT_START, Math.floor(first / 60) * 60)), end: Math.min(24 * 60, Math.max(DEFAULT_END, Math.ceil(last / 60) * 60)) };
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
