// The course list on the dashboard: one edit at a time on the stored list,
// and the two text lines of a row. Pure; immutable updates.

import type { CourseId, CourseRecord } from '../types';
import { isCourseActive } from './active-score';
import { courseAlias, toDisplayCase } from './display-name';
import { setActivePin, setAlias, setColor } from './edit';

export type CourseEdit = { kind: 'alias'; value: string } | { kind: 'color'; value: number | null } | { kind: 'monitor'; value: boolean };

/** Applies one inline edit: a display name (blank restores SIKOLA's), a color (null is automatic) or following on/off. */
export function applyCourseEdit(courses: readonly CourseRecord[], id: CourseId, edit: CourseEdit): CourseRecord[] {
  switch (edit.kind) {
    case 'alias':
      return setAlias(courses, id, edit.value);
    case 'color':
      return setColor(courses, id, edit.value);
    case 'monitor':
      return setActivePin(courses, id, edit.value);
  }
}

/** Second line of a row: SIKOLA's name in title case with its class letter ("Analisa Struktur I B"); the code is shown apart. */
export function sikolaName(course: Pick<CourseRecord, 'fullname' | 'parsed'>): string {
  if (!course.parsed.matched) return toDisplayCase(course.fullname);
  const name = toDisplayCase(course.parsed.name);
  return course.parsed.classLetter ? `${name} ${course.parsed.classLetter}` : name;
}

/** Followed and not followed, each sorted by the shown name. */
export function partitionCourses(courses: readonly CourseRecord[]): { followed: CourseRecord[]; others: CourseRecord[] } {
  const byName = (a: CourseRecord, b: CourseRecord) => courseAlias(a).localeCompare(courseAlias(b), 'id');
  return {
    followed: courses.filter(isCourseActive).sort(byName),
    others: courses.filter((c) => !isCourseActive(c)).sort(byName),
  };
}
