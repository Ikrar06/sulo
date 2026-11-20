// The NEOSIA checklist's next step (M8d): sign in, then the checklist
// sources in order (Beranda and KHS required, KRS optional), each done once
// its required responses were captured. Derived from sources.ts (the
// owner's final mapping of 18 Nov 2026), so the extension, the B0 trial card
// and the Android checklist read one truth. Pure.

import { CHECKLIST_SOURCES, sourceStatuses, type SourceId } from './sources';
import type { Snapshots } from './store';
import type { EndpointId } from './allowlist';

export type ChecklistStep = 'login' | SourceId | 'done';
export type OpenResult = 'signed_in' | 'needs_login' | 'closed' | null;

/** Sources done, from the endpoint ids captured (the B0 trial counts ids, not snapshots). */
export function sourcesDone(capturedEndpoints: Iterable<string>): Set<SourceId> {
  const got = new Set(capturedEndpoints);
  return new Set(CHECKLIST_SOURCES.filter((s) => s.requires.every((e) => got.has(e))).map((s) => s.id));
}

/** Sources done, from stored snapshots (the real checklist). */
export function sourcesDoneIn(snapshots: Snapshots): Set<SourceId> {
  return new Set(sourceStatuses(snapshots).filter((s) => s.has).map((s) => s.source.id));
}

/**
 * What to open next. A page that reached NEOSIA's login (needs_login), or
 * no sign-in yet: the login. Otherwise the first checklist source not done
 * (required first, then the optional KRS); all done: done.
 */
export function nextStep(input: { signedIn: boolean; lastResult: OpenResult; done: ReadonlySet<SourceId> }): ChecklistStep {
  if (input.lastResult === 'needs_login' || (!input.signedIn && input.lastResult !== 'signed_in')) return 'login';
  return CHECKLIST_SOURCES.find((s) => !input.done.has(s.id))?.id ?? 'done';
}

/** The endpoints a source needs (for showing what is missing). */
export const requiredFor = (id: SourceId): readonly EndpointId[] => CHECKLIST_SOURCES.find((s) => s.id === id)?.requires ?? [];
