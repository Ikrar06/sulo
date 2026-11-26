// The MKPK card's reminders (docs/mkpk/RENCANA-RINCI.md E, items a to e),
// matched from Sipakamase's stored fragments and NEOSIA's snapshots. Pure.
//
//   a  an MKPK course in the KRS, not passed in Sipakamase yet
//   b  passed in Sipakamase, its grade not in NEOSIA yet (claim it)
//   c  passed in Sipakamase, but not in the KRS (a claim needs the course programmed)
//   d  activity credits not converted yet
//   e  an activity in progress without a companion (it cannot be processed)
//
// Names are matched case- and space-insensitively; codes when both sides
// have one. Item a says "belum lulus", never "nilai T": the consequence is
// explained on the help page with its source and "konfirmasi ke KPS".

import type { MkpkProgress } from './progress';
import { activities, type SipakamaseData } from '../sipakamase/store';

export type MkpkReminder =
  | { kind: 'a'; name: string }
  | { kind: 'b'; name: string }
  | { kind: 'c'; name: string }
  | { kind: 'd'; sks: number; activities: number }
  | { kind: 'e'; name: string };

const key = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const round = (n: number) => Math.round(n * 100) / 100;

export function mkpkReminders(data: SipakamaseData | null, progress: Pick<MkpkProgress, 'enrolled' | 'passed'>): MkpkReminder[] {
  if (data === null) return [];
  const { claim, courses, conversions } = data.parts;
  const out: MkpkReminder[] = [];

  // Passed in Sipakamase, by name: the claim page's list, else the course list's.
  const passedSip = new Set([...(claim?.passed ?? []).map((p) => key(p.name)), ...(courses?.passed ?? []).map((p) => key(p.name))]);
  const passedCodes = new Set((claim?.passed ?? []).map((p) => p.code).filter((c): c is string => c !== null));
  const sipRead = claim !== undefined || courses !== undefined;

  // a: in the KRS (NEOSIA), not passed in Sipakamase.
  if (sipRead) {
    for (const e of progress.enrolled) {
      if (!passedCodes.has(e.code) && !passedSip.has(key(e.name))) out.push({ kind: 'a', name: e.name });
    }
  }

  // b: passed, not in NEOSIA yet.
  for (const p of claim?.passed ?? []) if (p.inNeosia === false) out.push({ kind: 'b', name: p.name });

  // c: passed in Sipakamase, but not on the claim page (which lists only programmed courses), not in the KRS, not on the transcript.
  if (claim !== undefined) {
    const enrolledNames = new Set(progress.enrolled.map((e) => key(e.name)));
    const onTranscript = new Set(progress.passed.map((p) => key(p.name)));
    const claimed = new Set(claim.passed.map((p) => key(p.name)));
    for (const p of courses?.passed ?? []) {
      const k = key(p.name);
      if (claimed.has(k) || enrolledNames.has(k) || onTranscript.has(k)) continue;
      out.push({ kind: 'c', name: p.name });
    }
  }

  // d: credits not converted yet.
  const open = (conversions ?? []).filter((c) => c.sksUnconverted > 0);
  if (open.length > 0) out.push({ kind: 'd', sks: round(open.reduce((s, c) => s + c.sksUnconverted, 0)), activities: open.length });

  // e: in progress, no companion.
  for (const a of activities(data)) if (a.stage === 'running' && a.hasCompanion === false && a.status !== 'finished') out.push({ kind: 'e', name: a.name });

  return out;
}
