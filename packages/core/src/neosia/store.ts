// NEOSIA snapshots in chrome.storage.local: the latest projection per
// endpoint with the service worker's own receive time (the page's time is
// not trusted). Pure; the store is injected. All keys start with
// NEOSIA_DATA_PREFIX, so turning the module off deletes them all.

import type { KeyValueStore, UnixSeconds } from '../types';
import { CAPTURE_SCHEMA_VERSION, ENDPOINTS, type EndpointId } from './allowlist';
import { NEOSIA_DATA_PREFIX, readModuleState } from './module';
import type { Projected } from './project';
import { parseCapture, stableStringify } from './schema';
import { readRemoteConfig } from '../remote/remote-config';
import { writeMkpkTranscript } from '../mkpk/transcript';

export const snapshotKey = (endpoint: EndpointId) => `${NEOSIA_DATA_PREFIX}snap:${endpoint}`;

export interface NeosiaSnapshot {
  endpoint: EndpointId;
  /** Capture schema version; a different one is a new baseline. */
  v: number;
  /** Last data in the known shape; kept when NEOSIA later answers in a shape Sulo does not know. */
  data: Projected | null;
  /** When this data was first received. */
  changedAt: UnixSeconds;
  /** Last time a response for this endpoint arrived ("Terakhir diperbarui"). */
  seenAt: UnixSeconds;
  /** Set when the latest response had an unknown shape ("NEOSIA berubah, data mungkin tidak lengkap"). */
  unknownShapeAt: UnixSeconds | null;
}

export type Snapshots = Partial<Record<EndpointId, NeosiaSnapshot>>;

/**
 * Snapshots of the current capture version only. One taken with an older
 * projection has other field names and would read as empty or wrong; it is
 * ignored until NEOSIA is opened again and replaces it.
 */
export async function readSnapshots(store: KeyValueStore): Promise<Snapshots> {
  const entries = await Promise.all(ENDPOINTS.map(async (e) => [e.id, await store.get<NeosiaSnapshot>(snapshotKey(e.id))] as const));
  return Object.fromEntries(entries.filter(([, s]) => s !== undefined && s.v === CAPTURE_SCHEMA_VERSION)) as Snapshots;
}

/** Snapshot keys of endpoints no longer on the allowlist (getStatusPembayaran): deleted at startup. */
export async function pruneUnlistedSnapshots(store: KeyValueStore): Promise<string[]> {
  const listed = new Set(ENDPOINTS.map((e) => snapshotKey(e.id)));
  const stale = (await store.keys(`${NEOSIA_DATA_PREFIX}snap:`)).filter((k) => !listed.has(k));
  if (stale.length > 0) await store.remove(stale);
  return stale;
}

export type IngestResult =
  | { kind: 'off' | 'rejected' }
  | { kind: 'stored'; endpoint: EndpointId; previous: NeosiaSnapshot | null; next: NeosiaSnapshot; changed: boolean; baseline: boolean };

/**
 * One capture from the bridge: validated again, then stored. `changed` is
 * true when the projected data differs from the stored one; `baseline` when
 * there was nothing comparable before (first capture, new schema version),
 * in which case no notification may follow.
 */
export async function ingestCapture(store: KeyValueStore, now: UnixSeconds, raw: unknown): Promise<IngestResult> {
  if (!(await readModuleState(store)).enabled) return { kind: 'off' };
  // The remote kill switch stops the NEOSIA module too (docs/NEOSIA.md): captures are dropped unread.
  if (!(await readRemoteConfig(store)).enabled) return { kind: 'off' };
  const capture = parseCapture(raw);
  if (!capture) return { kind: 'rejected' };
  const key = snapshotKey(capture.endpoint);
  const previous = (await store.get<NeosiaSnapshot>(key)) ?? null;
  const comparable = previous !== null && previous.v === CAPTURE_SCHEMA_VERSION && previous.data !== null;

  if (capture.status === 'unknown_shape') {
    const next: NeosiaSnapshot = previous
      ? { ...previous, seenAt: now, unknownShapeAt: now }
      : { endpoint: capture.endpoint, v: CAPTURE_SCHEMA_VERSION, data: null, changedAt: now, seenAt: now, unknownShapeAt: now };
    await store.set(key, next);
    return { kind: 'stored', endpoint: capture.endpoint, previous, next, changed: false, baseline: !comparable };
  }

  const data = capture.data ?? null;
  const changed = !comparable || stableStringify(previous.data) !== stableStringify(data);
  const next: NeosiaSnapshot = {
    endpoint: capture.endpoint,
    v: CAPTURE_SCHEMA_VERSION,
    data,
    changedAt: changed ? now : previous!.changedAt,
    seenAt: now,
    unknownShapeAt: null,
  };
  await store.set(key, next);
  // The MKPK card's own summary of the transcript (credits only, no grades): see mkpk/transcript.ts.
  if (capture.endpoint === 'getTranskripMahasiswa') await writeMkpkTranscript(store, data, now);
  return { kind: 'stored', endpoint: capture.endpoint, previous, next, changed, baseline: !comparable };
}

/** The newest receive time over all endpoints, or null before the first capture. */
export function lastSeenAt(snapshots: Snapshots): UnixSeconds | null {
  const times = Object.values(snapshots).map((s) => s!.seenAt);
  return times.length ? Math.max(...times) : null;
}
