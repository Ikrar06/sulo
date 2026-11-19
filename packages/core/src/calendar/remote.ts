// The academic calendar the extension uses: the copy bundled at build time,
// replaced by a newer file from sulo-data (once a day, through the generic
// public fetcher: no cookies, no headers, Zod-validated, data only).
// Pure: scheduler, storage and clock are injected.

import type { Scheduler } from '../net/scheduler';
import { fetchPublicJson } from '../remote/fetch-public';
import type { Clock, KeyValueStore } from '../types';
import bundledJson from './data/2026-2027.json';
import { calendarFileSchema, type CalendarFile } from './schema.ts';
import { shouldAccept } from './status.ts';

export const CALENDAR_KEY = 'global:calendar';
export const CALENDAR_FILE_KEY = 'global:remoteFile:calendar';

let bundledCache: CalendarFile | null = null;

/** The copy shipped with this version of the extension. */
export function bundledCalendar(): CalendarFile {
  bundledCache ??= calendarFileSchema.parse(bundledJson);
  return bundledCache;
}

/** The newer of the stored download and the bundled copy. */
export async function readCalendar(store: KeyValueStore): Promise<CalendarFile> {
  const bundled = bundledCalendar();
  const parsed = calendarFileSchema.safeParse(await store.get(CALENDAR_KEY));
  return parsed.success && shouldAccept(bundled, parsed.data) ? parsed.data : bundled;
}

export interface CalendarRefreshDeps {
  scheduler: Scheduler;
  store: KeyValueStore;
  clock: Clock;
  url: string;
  fetchSlotHour?: number;
  /** Hours since the last read before another (default 24; the phone uses 6 when the app is opened). */
  minGapHours?: number;
}

export type CalendarRefresh = 'not_due' | 'unchanged' | 'accepted' | 'kept' | 'invalid' | 'failed';

/** At most once a day. A file is kept only when it is valid and newer (shouldAccept). */
export async function refreshCalendar(deps: CalendarRefreshDeps): Promise<CalendarRefresh> {
  if (!deps.url) return 'not_due';
  const outcome = await fetchPublicJson({
    scheduler: deps.scheduler,
    store: deps.store,
    clock: deps.clock,
    url: deps.url,
    stateKey: CALENDAR_FILE_KEY,
    fetchSlotHour: deps.fetchSlotHour,
    trigger: 'calendar',
    minGapHours: deps.minGapHours,
  });
  if (outcome.kind === 'not_due' || outcome.kind === 'unchanged') return outcome.kind;
  if (outcome.kind === 'failed') return 'failed';
  const parsed = calendarFileSchema.safeParse(outcome.json);
  if (!parsed.success) return 'invalid';
  if (!shouldAccept(await readCalendar(deps.store), parsed.data)) return 'kept';
  await deps.store.set(CALENDAR_KEY, parsed.data);
  return 'accepted';
}
