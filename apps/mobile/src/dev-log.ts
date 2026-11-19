// Development builds: the remaining SIKOLA session time each batch reported
// (core_session_time_remaining), next to the session age log. Local only,
// never in a bug report; numbers and times, nothing else.

import type { KeyValueStore } from '@sulo/core/types';

export const TIME_REMAINING_KEY = 'mobile:dev:timeRemaining';
const MAX = 50;

export interface TimeRemainingEntry {
  at: number;
  seconds: number;
}

export async function recordTimeRemaining(store: KeyValueStore, at: number, body: string): Promise<void> {
  if (!__SULO_DEV__) return;
  let seconds: unknown;
  try {
    const first = (JSON.parse(body) as { error?: boolean; data?: { timeremaining?: unknown } }[])[0];
    seconds = first && first.error === false ? first.data?.timeremaining : undefined;
  } catch {
    return;
  }
  if (typeof seconds !== 'number') return;
  const list = (await store.get<TimeRemainingEntry[]>(TIME_REMAINING_KEY)) ?? [];
  await store.set(TIME_REMAINING_KEY, [{ at, seconds }, ...list].slice(0, MAX));
}
