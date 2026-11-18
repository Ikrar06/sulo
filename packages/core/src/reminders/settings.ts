// Reminder settings, stored with the device preferences (global, like the
// language). Validated with Zod; anything unreadable falls back to defaults.

import { z } from 'zod';

/** Offered reminder stages, in minutes before the due time. */
export const STAGE_OPTIONS = [4320, 1440, 360, 180, 60] as const;
export type StageMin = (typeof STAGE_OPTIONS)[number];

export interface ReminderSettings {
  enabled: boolean;
  /** Chosen stages, at least one. The smallest is the "last" reminder. */
  stages: StageMin[];
  quiet: { enabled: boolean; startMin: number; endMin: number };
  /** The last reminder still comes during quiet hours (deadlines at 23.59 are common). */
  lastStageDuringQuiet: boolean;
  morning: { enabled: boolean; atMin: number };
  /** "Tunda sampai besok pagi" lands at this local time. */
  snoozeMorningMin: number;
}

export const DEFAULT_REMINDERS: ReminderSettings = {
  enabled: true,
  stages: [4320, 1440, 180],
  quiet: { enabled: true, startMin: 22 * 60, endMin: 6 * 60 },
  lastStageDuringQuiet: true,
  morning: { enabled: false, atMin: 7 * 60 },
  snoozeMorningMin: 7 * 60,
};

const minuteOfDay = z.number().int().min(0).max(1439);
const stage = z.union(STAGE_OPTIONS.map((s) => z.literal(s)) as unknown as [z.ZodLiteral<StageMin>, z.ZodLiteral<StageMin>]);

export const reminderSettingsSchema = z.object({
  enabled: z.boolean().catch(DEFAULT_REMINDERS.enabled),
  stages: z
    .array(stage)
    .min(1)
    .transform((s) => [...new Set(s)].sort((a, b) => b - a))
    .catch(DEFAULT_REMINDERS.stages),
  quiet: z
    .object({ enabled: z.boolean(), startMin: minuteOfDay, endMin: minuteOfDay })
    .catch(DEFAULT_REMINDERS.quiet),
  lastStageDuringQuiet: z.boolean().catch(DEFAULT_REMINDERS.lastStageDuringQuiet),
  morning: z.object({ enabled: z.boolean(), atMin: minuteOfDay }).catch(DEFAULT_REMINDERS.morning),
  snoozeMorningMin: minuteOfDay.catch(DEFAULT_REMINDERS.snoozeMorningMin),
});

export const lastStage = (settings: ReminderSettings): StageMin => Math.min(...settings.stages) as StageMin;
