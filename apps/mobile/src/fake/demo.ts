// pnpm mobile:web only: the extension's synthetic demo account (fixtures/guide,
// no real name, student number or email), every time moved so "now" is when
// the page opened, plus made-up attendance. Nothing leaves the browser.

import seed from '../../../extension/fixtures/guide/demo-seed.json';
import { demoPresensi } from '../../../extension/scripts/lib/demo-presensi.mjs';
import type { KeyValueStore, UnixSeconds } from '@sulo/core/types';

const TIME_KEY = /At$|^at$|^dueAt$/;

/** Moves every timestamp by `shift` seconds (the same rule as scripts/lib/demo-storage.mjs). */
export function shiftTimes(value: unknown, shift: number, key = ''): unknown {
  if (Array.isArray(value)) return value.map((v) => shiftTimes(v, shift));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shiftTimes(v, shift, k)]));
  return typeof value === 'number' && TIME_KEY.test(key) && value > 1e9 ? value + shift : value;
}

export async function seedDemo(store: KeyValueStore, now: UnixSeconds): Promise<void> {
  const data = { ...(shiftTimes(seed.storage, now - seed.generatedAt) as Record<string, unknown>), ...demoPresensi(now) };
  for (const [key, value] of Object.entries(data)) await store.set(key, value);
}
