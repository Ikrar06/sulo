// What Sulo keeps from Sipakamase (docs/mkpk/RENCANA-RINCI.md C), one
// fragment at a time: each read replaces only its own part, so the keeper's
// one rotating GET never wipes what the others brought. Kept on the device
// under `sipakamase:`; never in the debug bundle, an export, ICS or a copied
// list. Deleted by Putuskan, a removed permission, a new SIKOLA account and
// "Hapus semua data". Pure functions plus two small store helpers.

import type { KeyValueStore, UnixSeconds } from '../types';
import type { ReadPath } from './allowlist';
import type { Activity, CollectedCourse, Conversion, PassedCourse, Programmed } from './parse';

export const SIPAKAMASE_DATA_PREFIX = 'sipakamase:';
export const SIPAKAMASE_DATA_KEY = `${SIPAKAMASE_DATA_PREFIX}data`;
/** The passive reader's message type (reader.ts sends it, schema.ts checks it). */
export const PASSIVE_MESSAGE_TYPE = 'sulo:sipakamase:v1';

export type FragmentId = 'running' | 'history' | 'courses' | 'claim' | 'conversions';

export const FRAGMENT_PATH: Record<FragmentId, ReadPath> = {
  running: '/caktifitasmahasiswa/content',
  history: '/caktifitas/content',
  courses: '/ckonversimhs/matakuliah',
  claim: '/cklaim/content',
  conversions: '/ckonversimhs/rekappoin',
};
export const FRAGMENTS = Object.keys(FRAGMENT_PATH) as FragmentId[];

export interface FragmentData {
  running: Activity[];
  history: Activity[];
  courses: { passed: CollectedCourse[]; notPassed: CollectedCourse[] };
  claim: { passed: PassedCourse[]; programmed: Programmed[] };
  conversions: Conversion[];
}

export type FragmentValue<F extends FragmentId = FragmentId> = { [K in F]: { fragment: K; data: FragmentData[K] } }[F];

export interface SipakamaseData {
  v: 1;
  /** When each fragment was last read successfully. */
  readAt: Partial<Record<FragmentId, UnixSeconds>>;
  /** When each fragment last changed (for the "kabar" comparison in M5). */
  changedAt: Partial<Record<FragmentId, UnixSeconds>>;
  parts: Partial<FragmentData>;
}

export const EMPTY_DATA: SipakamaseData = { v: 1, readAt: {}, changedAt: {}, parts: {} };

/** A copy with one fragment replaced; `changedAt` moves only when its content differs. */
export function applyFragment(data: SipakamaseData, value: FragmentValue, now: UnixSeconds): SipakamaseData {
  const before = data.parts[value.fragment];
  const changed = before === undefined || JSON.stringify(before) !== JSON.stringify(value.data);
  return {
    v: 1,
    readAt: { ...data.readAt, [value.fragment]: now },
    changedAt: changed ? { ...data.changedAt, [value.fragment]: now } : data.changedAt,
    parts: { ...data.parts, [value.fragment]: value.data },
  };
}

/** The last successful read of any fragment; null before the first. */
export function lastReadAt(data: SipakamaseData): UnixSeconds | null {
  const times = Object.values(data.readAt).filter((t): t is number => typeof t === 'number');
  return times.length > 0 ? Math.max(...times) : null;
}

export interface ActivityView extends Activity {
  stage: 'running' | 'history';
  sksTotal: number | null;
  sksUnconverted: number | null;
}

const key = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Both activity lists with their credits from the conversion recap, matched by name. */
export function activities(data: SipakamaseData): ActivityView[] {
  const conv = new Map((data.parts.conversions ?? []).map((c) => [key(c.name), c]));
  const view = (stage: ActivityView['stage']) => (a: Activity): ActivityView => {
    const c = conv.get(key(a.name));
    return { ...a, stage, sksTotal: c?.sksTotal ?? null, sksUnconverted: c?.sksUnconverted ?? null };
  };
  return [...(data.parts.running ?? []).map(view('running')), ...(data.parts.history ?? []).map(view('history'))];
}

/**
 * Something Sulo waits for, which only changes without the student: an
 * activity in progress not finished yet (an unknown status counts), or a
 * passed course not in NEOSIA yet. Unknown before the first reads of both
 * fragments, so the keeper keeps going until it knows.
 */
export function hasPending(data: SipakamaseData): boolean {
  const { running, claim } = data.parts;
  if (running === undefined || claim === undefined) return true;
  return running.some((a) => a.status !== 'finished') || claim.passed.some((p) => p.inNeosia !== true);
}

export async function readSipakamaseData(store: KeyValueStore): Promise<SipakamaseData> {
  const raw = await store.get<SipakamaseData>(SIPAKAMASE_DATA_KEY);
  return raw && raw.v === 1 && typeof raw.readAt === 'object' && typeof raw.parts === 'object' ? { ...EMPTY_DATA, ...raw } : EMPTY_DATA;
}

export const writeSipakamaseData = (store: KeyValueStore, data: SipakamaseData) => store.set(SIPAKAMASE_DATA_KEY, data);

/** Deletes every Sipakamase data key (data, connection, keeper). */
export async function wipeSipakamaseData(store: KeyValueStore): Promise<void> {
  const keys = await store.keys(SIPAKAMASE_DATA_PREFIX);
  if (keys.length > 0) await store.remove(keys);
}
