// Local usage counters (M5a). Only counts, never content: no task names,
// courses, grades or account. Kept in this browser; never sent anywhere.
// The user may export them as a file and share it themselves (voluntary).

import { z } from 'zod';
import type { KeyValueStore } from '../types';

export const USAGE_KEY = 'global:usage';

export const USAGE_COUNTERS = ['popupOpens', 'dashboardOpens', 'tasksMarkedDone', 'remindersShown', 'calendarRemindersShown', 'updatesShown'] as const;
export type UsageCounter = (typeof USAGE_COUNTERS)[number];

export interface Usage {
  /** Local date the counting started. */
  since: string;
  counters: Record<UsageCounter, number>;
}

const zeroCounters = (): Record<UsageCounter, number> => Object.fromEntries(USAGE_COUNTERS.map((c) => [c, 0])) as Record<UsageCounter, number>;

const usageSchema = z.object({
  since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  counters: z.object(Object.fromEntries(USAGE_COUNTERS.map((c) => [c, z.number().int().nonnegative().catch(0)])) as Record<UsageCounter, z.ZodCatch<z.ZodNumber>>),
});

export async function readUsage(store: KeyValueStore, today: string): Promise<Usage> {
  const parsed = usageSchema.safeParse(await store.get(USAGE_KEY));
  return parsed.success ? parsed.data : { since: today, counters: zeroCounters() };
}

/** Pure: a new Usage with `counter` raised by `n`. */
export function bump(usage: Usage, counter: UsageCounter, n = 1): Usage {
  return { ...usage, counters: { ...usage.counters, [counter]: usage.counters[counter] + Math.max(0, Math.floor(n)) } };
}

export async function bumpUsage(store: KeyValueStore, today: string, counter: UsageCounter, n = 1): Promise<void> {
  if (n <= 0) return;
  await store.set(USAGE_KEY, bump(await readUsage(store, today), counter, n));
}

/** The exported file: counts, the version and the dates. Nothing else. */
export function exportUsage(usage: Usage, version: string, exportedOn: string): string {
  return `${JSON.stringify({ sulo: version, since: usage.since, exportedOn, counters: usage.counters }, null, 2)}\n`;
}
