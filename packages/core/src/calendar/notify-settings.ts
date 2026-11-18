// Which academic calendar events notify (M5a). On by default, each kind can
// be turned off in the dashboard settings. Stored with the device
// preferences. Small on purpose: the popup bundle imports it through prefs.

import { z } from 'zod';

/** Notification kinds, derived from an event by lib/calendar/notify.ts. */
export const CALENDAR_NOTIFY_KINDS = ['krs', 'ukt', 'uts', 'uas', 'pembatalan', 'pengunduran', 'sanggah'] as const;
export type CalendarNotifyKind = (typeof CALENDAR_NOTIFY_KINDS)[number];

export type CalendarNotifySettings = Record<CalendarNotifyKind, boolean>;

export const DEFAULT_CALENDAR_NOTIFY: CalendarNotifySettings = {
  krs: true,
  ukt: true,
  uts: true,
  uas: true,
  pembatalan: true,
  pengunduran: true,
  sanggah: true,
};

export const calendarNotifySchema = z
  .object(Object.fromEntries(CALENDAR_NOTIFY_KINDS.map((k) => [k, z.boolean().catch(true)])) as Record<CalendarNotifyKind, z.ZodCatch<z.ZodBoolean>>)
  .catch(DEFAULT_CALENDAR_NOTIFY);
