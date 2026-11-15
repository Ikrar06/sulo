// Device preferences: language and due-time format. Global (not per user):
// they describe how this browser shows Sulo, not anyone's data. Validated
// with Zod; anything unreadable falls back to the defaults.

import { z } from 'zod';
import type { Locale } from './i18n';
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

export interface Prefs {
  /** null: follow the browser language. */
  locale: Locale | null;
  dueFormat: DueFormat;
  reminders: ReminderSettings;
}

export const DEFAULT_PREFS: Prefs = { locale: null, dueFormat: 'both', reminders: DEFAULT_REMINDERS };

const prefsSchema = z.object({
  locale: z.enum(['id', 'en']).nullable().catch(null),
  dueFormat: z.enum(['both', 'remaining', 'clock', 'countdown']).catch('both'),
  reminders: reminderSettingsSchema.catch(DEFAULT_REMINDERS),
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
