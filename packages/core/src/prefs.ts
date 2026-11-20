// Device preferences: language, due-time format, theme, reminders and the
// optional nickname and intake year. Global (not per user):
// they describe how this browser shows Sulo, not anyone's data. Validated
// with Zod; anything unreadable falls back to the defaults.

import type { AnimationPref } from './perf/tier';
import { DEFAULT_GROUP_FILTER, groupFilterSchema, type GroupFilter } from './calendar/groups';
import { z } from 'zod';
import type { Locale } from './i18n';
import { calendarNotifySchema, DEFAULT_CALENDAR_NOTIFY, type CalendarNotifySettings } from './calendar/notify-settings';
import { DEFAULT_UPDATES, updateSettingsSchema, type UpdateSettings } from './radar/settings';
import { DEFAULT_REMINDERS, reminderSettingsSchema, type ReminderSettings } from './reminders/settings';
import type { KeyValueStore } from './types';

export const PREFS_KEY = 'global:prefs';

/**
 * How due times read in the popup (text only: badge, notifications and the
 * copied list never use it).
 * - both: "5 jam lagi" over "Kamis 23.59"; from 7 days on only the date and
 *   time, because a large count of days says little.
 * - remaining: "5 jam", "3 hari".
 * - clock: "Kamis 23.59".
 * - countdown: "05:12:30 lagi", "2 hari 05:12:30", ticking every second.
 */
export type DueFormat = 'both' | 'remaining' | 'clock' | 'countdown';
export const DUE_FORMATS: readonly DueFormat[] = ['both', 'remaining', 'clock', 'countdown'];

/** "system" follows the operating system; the others set data-theme on <html>. */
export type Theme = 'system' | 'dark' | 'light';
export const THEMES: readonly Theme[] = ['system', 'light', 'dark'];

/** Nicknames stay short: they only greet the user on the dashboard. */
export const NICKNAME_MAX = 24;

/** Trimmed and cut to NICKNAME_MAX characters (code points, so emoji stay whole). */
export function normalizeNickname(raw: string): string {
  return Array.from(raw.trim()).slice(0, NICKNAME_MAX).join('').trim();
}

export interface Prefs {
  /** null: follow the browser language. */
  locale: Locale | null;
  dueFormat: DueFormat;
  reminders: ReminderSettings;
  /** Which kinds of updates notify (materials, deadlines, grades, forum). */
  updates: UpdateSettings;
  theme: Theme;
  /** Optional, local only; '' means none. */
  nickname: string;
  /** Optional intake year, chosen by the user (never read from the student number); filters study evaluations. */
  angkatan: number | null;
  /** Academic calendar notifications per kind. */
  calendar: CalendarNotifySettings;
  /** Which groups the calendar page shows (its chips are legend and filter). */
  calendarFilter: GroupFilter;
  /** Masks names, grades, GPA and credits on screen (M7); local to this browser. */
  privacyMode: boolean;
  /** Credits to graduate, the scale of the overview's credits bar (NEOSIA, 100 to 200). */
  sksTarget: number;
  /** Android (M8d): grades and GPA are shown only once turned on in Pengaturan; hidden by default. */
  gradesShown: boolean;
  /** Mobile: how much motion (perf/tier.ts); "auto" follows the detected tier. */
  animation: AnimationPref;
}

export const DEFAULT_PREFS: Prefs = {
  locale: null,
  dueFormat: 'both',
  reminders: DEFAULT_REMINDERS,
  updates: DEFAULT_UPDATES,
  theme: 'system',
  nickname: '',
  angkatan: null,
  calendar: DEFAULT_CALENDAR_NOTIFY,
  calendarFilter: DEFAULT_GROUP_FILTER,
  privacyMode: false,
  sksTarget: 144,
  gradesShown: false,
  animation: 'auto',
};

const prefsSchema = z.object({
  locale: z.enum(['id', 'en']).nullable().catch(null),
  dueFormat: z.enum(['both', 'remaining', 'clock', 'countdown']).catch('both'),
  reminders: reminderSettingsSchema.catch(DEFAULT_REMINDERS),
  updates: updateSettingsSchema,
  theme: z.enum(['system', 'dark', 'light']).catch('system'),
  // Longer values from before the 24-character limit are cut, not dropped.
  nickname: z.string().transform(normalizeNickname).catch(''),
  angkatan: z.number().int().min(1990).max(2100).nullable().catch(null),
  calendar: calendarNotifySchema,
  calendarFilter: groupFilterSchema,
  privacyMode: z.boolean().catch(false),
  sksTarget: z.number().int().min(100).max(200).catch(144),
  gradesShown: z.boolean().catch(false),
  animation: z.enum(['auto', 'full', 'lite']).catch('auto'),
});

export async function readPrefs(store: KeyValueStore): Promise<Prefs> {
  const parsed = prefsSchema.safeParse((await store.get<unknown>(PREFS_KEY)) ?? {});
  return parsed.success ? parsed.data : DEFAULT_PREFS;
}

export async function writePrefs(store: KeyValueStore, patch: Partial<Prefs>): Promise<Prefs> {
  const next = { ...(await readPrefs(store)), ...patch };
  await store.set(PREFS_KEY, next);
  return next;
}
