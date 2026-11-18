// The Android app's Ringkasan greeting (M8c.1): line 1 by the local hour,
// line 2 a friendly phrase for the slot (or the nickname), and the state
// line under it. Pure and deterministic: the phrase is the same all day in a
// slot and changes the next day (day of the year modulo the candidates).
// Casual phrases ([s]) only when nothing is overdue and nothing is due
// today. The extension's dashboard keeps its own greeting (greeting.ts).

import type { MobileWords } from '../i18n/mobile';
import { localParts } from '../reminders/zoned';
import type { UnixSeconds } from '../types';

export type GreetSlot = 'pagi' | 'siang' | 'sore' | 'malam' | 'tengahMalam';

/** pagi 04-10, siang 11-14, sore 15-17, malam 18-23, tengah malam 00-03 (local hours). */
export function greetSlot(hour: number): GreetSlot {
  if (hour >= 4 && hour <= 10) return 'pagi';
  if (hour >= 11 && hour <= 14) return 'siang';
  if (hour >= 15 && hour <= 17) return 'sore';
  if (hour >= 18) return 'malam';
  return 'tengahMalam';
}

/** 1 for 1 January (YYYY-MM-DD in local time). */
export function dayOfYear(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
}

export interface GreetingInput {
  now: UnixSeconds;
  timeZone: string;
  nickname: string;
  /** Casual phrases only when both are 0. */
  overdue: number;
  dueToday: number;
}

export interface Greeting {
  slot: GreetSlot;
  line1: string;
  /** The nickname with a full stop, or the slot's phrase. */
  line2: string;
  /** Line 2 is set at 22 instead of 26 so it fits one line beside the mascot. */
  line2Small: boolean;
  /** The day's phrase (shown on the state line instead of "all clear" when a nickname takes line 2). */
  phrase: string;
}

export function greeting({ now, timeZone, nickname, overdue, dueToday }: GreetingInput, w: MobileWords): Greeting {
  const { dateKey, minuteOfDay } = localParts(now, timeZone);
  const slot = greetSlot(Math.floor(minuteOfDay / 60));
  const busy = overdue > 0 || dueToday > 0;
  const candidates = w.greet.phrases[slot].filter((p) => !busy || !p.casual);
  const pick = candidates[dayOfYear(dateKey) % candidates.length]!;
  const name = nickname.trim();
  return { slot, line1: w.greet.line1[slot], line2: name ? `${name}.` : pick.text, line2Small: !name && pick.small === true, phrase: pick.text };
}

export interface StateLine {
  /** The overdue count, drawn in the warning color, when the line starts with it. */
  count: string | null;
  text: string;
}

/**
 * The line under the greeting, first match wins: the session ended, overdue
 * tasks, due today, due tomorrow, else all clear (or the day's phrase when a
 * nickname took line 2).
 */
export function greetingState({ sessionExpired, overdue, dueToday, dueTomorrow, nickname, phrase }: { sessionExpired: boolean; overdue: number; dueToday: number; dueTomorrow: number; nickname: string; phrase: string }, w: MobileWords): StateLine {
  const s = w.greet.state;
  if (sessionExpired) return { count: null, text: s.expired };
  if (overdue > 0) {
    const [n, rest] = s.overdue(overdue);
    return { count: n, text: rest };
  }
  if (dueToday > 0) return { count: null, text: s.today(dueToday) };
  if (dueTomorrow > 0) return { count: null, text: s.tomorrow(dueTomorrow) };
  if (nickname.trim()) return { count: null, text: phrase.charAt(0).toUpperCase() + phrase.slice(1) };
  return { count: null, text: s.clear };
}
