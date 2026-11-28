// What the MKPK card shows from Sipakamase (1.1.0): credits passed but not
// in NEOSIA yet, and activity credits not converted yet. Pure, from the
// stored fragments (sipakamase/store.ts); NEOSIA's own numbers stay in
// progress.ts.

import type { Connection } from '../sipakamase/connection';
import { lastReadAt, type SipakamaseData } from '../sipakamase/store';
import type { UnixSeconds } from '../types';

export interface SipakamaseSummary {
  connected: boolean;
  state: Connection['state'];
  readAt: UnixSeconds | null;
  /** Passed in Sipakamase, not in NEOSIA yet (null: the claim page was never read). */
  notInNeosiaSks: number | null;
  notInNeosia: { name: string; sks: number }[];
  /** Activity credits not converted to a course yet (null: the recap was never read). */
  unconvertedSks: number | null;
  unconvertedActivities: number;
}

/** Credits with two decimals at most, without floating-point dust (0.58 + 0.92 = 1.5). */
const round = (n: number) => Math.round(n * 100) / 100;

export function summarizeSipakamase(data: SipakamaseData | null, connection: Connection): SipakamaseSummary {
  const connected = connection.state !== 'off';
  if (!connected || data === null) {
    return { connected, state: connection.state, readAt: null, notInNeosiaSks: null, notInNeosia: [], unconvertedSks: null, unconvertedActivities: 0 };
  }
  const claim = data.parts.claim;
  const notInNeosia = (claim?.passed ?? []).filter((p) => p.inNeosia === false).map((p) => ({ name: p.name, sks: p.sks }));
  // The conversion recap is the source of activity credits.
  const recap = (data.parts.conversions ?? []).filter((c) => c.sksUnconverted > 0);
  return {
    connected,
    state: connection.state,
    readAt: lastReadAt(data),
    notInNeosiaSks: claim ? round(notInNeosia.reduce((s, p) => s + p.sks, 0)) : null,
    notInNeosia,
    unconvertedSks: data.parts.conversions ? round(recap.reduce((s, c) => s + c.sksUnconverted, 0)) : null,
    unconvertedActivities: recap.length,
  };
}
