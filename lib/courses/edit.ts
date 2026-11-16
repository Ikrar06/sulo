// Course overrides from the dashboard: display name, color, active pin.
// Local only, never sent anywhere; immutable updates.

import type { CourseId, CourseRecord } from '../types';
import { COURSE_COLOR_COUNT } from './colors';

export const ALIAS_MAX = 60;

const update = (courses: readonly CourseRecord[], id: CourseId, change: Partial<CourseRecord>): CourseRecord[] =>
  courses.map((c) => (c.id === id ? { ...c, ...change } : c));

/** Blank text restores the name from SIKOLA. */
export function setAlias(courses: readonly CourseRecord[], id: CourseId, alias: string): CourseRecord[] {
  const clean = alias.trim().replace(/\s+/g, ' ').slice(0, ALIAS_MAX);
  return update(courses, id, { alias: clean === '' ? null : clean });
}

/** 1..8 picks a course color token; null returns to the automatic color. */
export function setColor(courses: readonly CourseRecord[], id: CourseId, color: number | null): CourseRecord[] {
  if (color !== null && (!Number.isInteger(color) || color < 1 || color > COURSE_COLOR_COUNT)) return [...courses];
  return update(courses, id, { color: color === null ? null : `course-${color}` });
}

export function setActivePin(courses: readonly CourseRecord[], id: CourseId, active: boolean | null): CourseRecord[] {
  return update(courses, id, { activePin: active });
}
