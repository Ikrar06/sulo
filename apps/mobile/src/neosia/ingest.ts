// After the NEOSIA screen closes: the captures it queued go through core's
// gate (admitCapture: the allowlist's Zod schema, 256 KiB, schema v2, the
// 5-second dedupe) and core's ingestCapture into the encrypted store. A
// rejected message is dropped without anything of it being recorded. A write
// that fails is never silent: the technical log gets the endpoint's name and
// "store_failed" (no data), so a bug report shows it.

import { admitCapture } from '@sulo/core/neosia/bridge';
import { ingestCapture } from '@sulo/core/neosia/store';
import { recordTech } from '@sulo/core/net/tech-log';
import type { KeyValueStore } from '@sulo/core/platform';

// Only ordering and dedupe (endpoint + data hash), no data: lost on restart, harmless.
let recent: ReadonlyMap<string, number> = new Map();

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface IngestDeps {
  take: () => Promise<{ messages: string[] }>;
  store: KeyValueStore;
  now: () => number;
  nowMs?: () => number;
}

/** How many captures were stored (the rest were rejected, duplicates, or the module was off). */
export async function ingestQueued(deps: IngestDeps): Promise<number> {
  const { messages } = await deps.take().catch(() => ({ messages: [] as string[] }));
  let stored = 0;
  for (const text of messages) {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      continue;
    }
    const verdict = await admitCapture(data, recent, (deps.nowMs ?? Date.now)(), sha256Hex);
    recent = verdict.recent;
    if (!verdict.capture) continue;
    const result = await ingestCapture(deps.store, deps.now(), verdict.capture).catch(() => 'failed' as const);
    if (result === 'failed') {
      await recordTech(deps.store, { at: deps.now(), fn: `neosia:${verdict.capture.endpoint}`, status: 'store_failed' }).catch(() => undefined);
      continue;
    }
    if (result?.kind === 'stored') stored++;
  }
  return stored;
}

/** Tests: forget the dedupe window. */
export const resetIngest = () => void (recent = new Map());
