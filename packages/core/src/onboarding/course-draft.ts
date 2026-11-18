// The course choice in setup and in "Mata kuliahmu" is a draft until saved.
// Pure helpers, tested in Vitest.

import type { CourseRecord } from '../types';

/** True when any course's pin differs from the stored list. */
export function hasCourseChanges(stored: readonly CourseRecord[], draft: readonly CourseRecord[]): boolean {
  const pins = new Map(stored.map((c) => [c.id, c.activePin]));
  return draft.some((c) => pins.get(c.id) !== c.activePin);
}

/**
 * After "Segarkan daftar": the refreshed list, with the choices the user
 * already made in the draft kept for courses that are still there.
 */
export function mergeDraft(refreshed: readonly CourseRecord[], draft: readonly CourseRecord[], stored: readonly CourseRecord[]): CourseRecord[] {
  const storedPins = new Map(stored.map((c) => [c.id, c.activePin]));
  const edited = new Map(draft.filter((c) => storedPins.get(c.id) !== c.activePin).map((c) => [c.id, c.activePin]));
  return refreshed.map((c) => (edited.has(c.id) ? { ...c, activePin: edited.get(c.id) ?? null } : c));
}

/** Toggles one course in the draft (never written until saved). */
export function toggleDraft(draft: readonly CourseRecord[], courseId: number, active: boolean): CourseRecord[] {
  return draft.map((c) => (c.id === courseId ? { ...c, activePin: active } : c));
}
